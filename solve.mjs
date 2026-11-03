// Keeps, for each TV player script YouTube uses, the code that computes its n parameter, as yt-dlp's solver
// (github.com/yt-dlp/ejs) makes it, in JavaScript that old TVs run (ES5). For Bolli YouTube: an app that cannot find
// the n transform in the player script itself (YouTube changed it) loads players/<id>/<name>.js and adds it at the
// end of the script's closure (before its last "}).call(this);"), where it sets self.__bolliN.
//
// Each run first checks what YouTube's TV page uses and yt-dlp's latest solver release, and stops if that is done
// already (or failed less than RETRY_MS ago). Else it runs the solver as it is (here, in Node), takes the n code it
// adds to the player script, turns that into ES5 (Babel, plus polyfills.js) and checks it before writing it: it parses
// as ES5, and in the player script, run as an old TV's worker would (without the newer built-ins), it gives the
// solver's own answers. A check that fails writes nothing and fails the run, so the last good one stays.
//
//   npm run solve                 check, and prepare what changed
//   npm run solve -- --check      only check: prints what changed (needs no packages installed)
//   npm run solve -- --force      prepare again even if nothing changed
// (YouTube's TV page sends long headers: package.json raises Node's limit)

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const STATE = path.join(ROOT, 'state.json');
const PLAYERS = path.join(ROOT, 'players');
/** Player scripts kept (the newest) */
const KEPT = 20;
/** A player script whose preparation failed is tried again after this long, or as soon as the solver changes */
const RETRY_MS = 6 * 3600 * 1000;
/** The TV browsers YouTube's TV page is asked as: a 2017 LG TV, and a newer one */
const AGENTS = [
    'LG Browser/8.00.00 (webOS.TV-2017), _TV_O18/06.00.25 (LG, OLED55C7V-Z, wired)',
    'Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 WebAppManager'
];
/** Times each is asked per run: YouTube serves a few player script versions at once while it rolls one out */
const ASKS = 3;
/** n values the converted code must answer as the solver does */
const CHALLENGES = ['abcdefghijklmnopqrst', 'zyxwvutsrqponmlkjihg', 'Q2xpY2tCYWl0X1Rlc3Q', 'r2D2-c3P0_bb8xy', 'AAAAAAAAAAAAAAAAAAAA'];
/** Where the code goes in the player script: before its closure's end */
const END = '}).call(this);';
/** Bolli YouTube's window stubs for the player script in its worker */
const STUB = 'var window=self,top=self,parent=self;self.document={createElement:function(){return{style:{},setAttribute:function(){},' +
    'appendChild:function(){},getContext:function(){return null}}},documentElement:{style:{}},addEventListener:function(){},' +
    'getElementsByTagName:function(){return[]},querySelector:function(){return null},cookie:"",location:self.location,body:null,head:null};' +
    'var document=self.document;\n';
/** Built-ins old TVs (Chrome 38) lack: removed before the code runs in the check */
const TYPED = 'Object.getPrototypeOf(Uint8Array.prototype).';
const NEWER = ['globalThis', 'Reflect', 'Proxy', 'WeakRef', 'FinalizationRegistry', 'queueMicrotask', 'structuredClone',
    'Array.from', 'Array.of', 'Object.assign', 'Object.entries', 'Object.values', 'Object.fromEntries',
    'Object.getOwnPropertyDescriptors', 'Object.hasOwn', 'String.fromCodePoint', 'String.raw',
    'Promise.prototype.finally', 'Promise.allSettled', 'Promise.any',
    'Object.getPrototypeOf(Uint8Array).from', 'Object.getPrototypeOf(Uint8Array).of']
    .concat(['find', 'findIndex', 'findLast', 'findLastIndex', 'fill', 'copyWithin', 'includes', 'flat', 'flatMap', 'at',
        'values'].map((m) => 'Array.prototype.' + m))
    .concat(['includes', 'startsWith', 'endsWith', 'repeat', 'codePointAt', 'padStart', 'padEnd', 'trimStart', 'trimEnd',
        'matchAll', 'replaceAll', 'at'].map((m) => 'String.prototype.' + m))
    .concat(['slice', 'fill', 'indexOf', 'lastIndexOf', 'includes', 'join', 'map', 'forEach', 'filter', 'reduce',
        'reduceRight', 'every', 'some', 'find', 'findIndex', 'reverse', 'sort', 'copyWithin', 'at'].map((m) => TYPED + m));

const force = process.argv.includes('--force');
const checkOnly = process.argv.includes('--check');

async function get(url, init) {
    const r = await fetch(url, init).catch((e) => {
        throw new Error(url + ': ' + (e.cause && (e.cause.code || e.cause.message) || e.message));
    });
    if (!r.ok) {
        throw new Error(url + ': ' + r.status);
    }
    return r;
}

/** The player scripts YouTube's TV page loads (their paths, e.g. /s/player/<id>/tv-player-ias.vflset/tv-player-ias.js) */
async function players() {
    const found = new Set();
    const asks = AGENTS.flatMap((agent) => Array(ASKS).fill(agent));
    await Promise.all(asks.map(async (agent) => {
        const html = await (await get('https://www.youtube.com/tv', { headers: { 'User-Agent': agent } })).text();
        const m = /\/s\/player\/[\w-]+\/tv-player[\w-]*\.vflset\/[\w-]+\.js/.exec(html);
        if (m) {
            found.add(m[0]);
        }
    }));
    if (!found.size) {
        throw new Error('YouTube\'s TV page names no TV player script');
    }
    return [...found];
}

/** yt-dlp's latest solver release */
async function latestSolver() {
    const headers = process.env.GITHUB_TOKEN ? { Authorization: 'Bearer ' + process.env.GITHUB_TOKEN } : {};
    return (await (await get('https://api.github.com/repos/yt-dlp/ejs/releases/latest', { headers })).json()).tag_name;
}

/** Where a player script's code goes: players/<id>/<name>.js */
function fileOf(playerPath) {
    const m = /\/s\/player\/([\w-]+)\/[\w-]+\.vflset\/([\w-]+)\.js$/.exec(playerPath);
    return path.join(m[1], m[2] + '.js');
}

/** The solver of a release, as a function of its input */
async function solver(tag) {
    const asset = async (name) => (await get('https://github.com/yt-dlp/ejs/releases/download/' + tag + '/' + name)).text();
    const ctx = vm.createContext({ console });
    vm.runInContext(await asset('yt.solver.lib.min.js') + '\nthis.meriyah = lib.meriyah; this.astring = lib.astring;', ctx);
    vm.runInContext(await asset('yt.solver.core.js') + '\nthis.jsc = jsc;', ctx);
    return ctx.jsc;
}

/** The statement the solver adds to the player script's closure to set _result.n */
function nStatement(acorn, prepared) {
    const program = acorn.parse(prepared, { ecmaVersion: 'latest' });
    const last = program.body[program.body.length - 1];
    const call = last && last.type === 'ExpressionStatement' && last.expression.type === 'CallExpression' && last.expression;
    const fn = call && (call.callee.type === 'MemberExpression' ? call.callee.object : call.callee);
    const body = fn && fn.type === 'FunctionExpression' ? fn.body.body : [];
    const found = body.find((s) => s.type === 'ExpressionStatement' && s.expression.type === 'AssignmentExpression' &&
        prepared.slice(s.expression.left.start, s.expression.left.end) === '_result.n');
    if (!found) {
        throw new Error('the solver\'s prepared script has no _result.n');
    }
    return prepared.slice(found.start, found.end);
}

/** The n statement as ES5 code that sets self.__bolliN, polyfills first */
function convert(babel, statement, made) {
    const es5 = babel.transformSync('(function (_result) {\n' + statement + '\nself.__bolliN = _result.n;\n})({});\n', {
        configFile: false,
        babelrc: false,
        sourceType: 'script',
        compact: true,
        presets: [['@babel/preset-env', { targets: { chrome: '38' }, modules: false }]]
    }).code;
    return '/* ' + made + ' */\n' + fs.readFileSync(path.join(ROOT, 'polyfills.js'), 'utf8') + es5 + '\n';
}

/** A context like a TV's worker, without the built-ins old TVs lack */
function oldWorker() {
    function XMLHttpRequest() {}
    XMLHttpRequest.prototype.open = function () {};
    XMLHttpRequest.prototype.send = function () {};
    const ctx = vm.createContext({
        console, URL, Blob, TextEncoder, TextDecoder, atob, btoa, XMLHttpRequest,
        navigator: { userAgent: AGENTS[0] },
        location: { href: 'https://www.youtube.com/tv', protocol: 'https:', host: 'www.youtube.com', hostname: 'www.youtube.com',
            origin: 'https://www.youtube.com', pathname: '/tv', search: '', hash: '' },
        setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
        postMessage() {}, addEventListener() {}, removeEventListener() {}, importScripts() {},
        performance: { now: () => 0, timing: {} }
    });
    ctx.self = ctx;
    vm.runInContext(NEWER.map((name) => 'delete ' + name + ';').join('\n'), ctx);
    return ctx;
}

/** Throws unless the code parses as ES5 and, in the player script run as an old TV's worker would, answers as
 * expected */
function check(acorn, player, code, expected) {
    acorn.parse(code, { ecmaVersion: 5 });
    const end = player.lastIndexOf(END);
    if (end < 0) {
        throw new Error('the player script does not end with ' + END);
    }
    const whole = player.slice(0, end) + ';' + code + player.slice(end);
    acorn.parse(whole, { ecmaVersion: 5 });
    const ctx = oldWorker();
    vm.runInContext(STUB + whole, ctx);
    if (typeof ctx.__bolliN !== 'function') {
        throw new Error('no n transform set');
    }
    for (const c of CHALLENGES) {
        const got = ctx.__bolliN(c);
        if (got !== expected[c]) {
            throw new Error('n of ' + c + ': ' + got + ', the solver says ' + expected[c]);
        }
    }
}

/** Prepares one player script with the solver: writes its code and notes it in state */
async function prepare(p, tag, solve, state) {
    const [{ default: babel }, acorn] = await Promise.all([import('@babel/core'), import('acorn')]);
    const player = await (await get('https://www.youtube.com' + p)).text();
    const solved = solve({ type: 'player', player, output_preprocessed: true, requests: [{ type: 'n', challenges: CHALLENGES }] });
    const answer = solved.responses[0];
    if (answer.type !== 'result' || !solved.preprocessed_player) {
        throw new Error('the solver found no n transform: ' + (answer.error || ''));
    }
    const code = convert(babel, nStatement(acorn, solved.preprocessed_player), 'For YouTube\'s ' + p + ': its n transform as yt-dlp\'s solver ' +
        tag + ' computes it (github.com/yt-dlp/ejs, Unlicense), made ES5 by github.com/aktiwers/bolli-solver');
    check(acorn, player, code, answer.data);
    const file = fileOf(p);
    fs.mkdirSync(path.dirname(path.join(PLAYERS, file)), { recursive: true });
    fs.writeFileSync(path.join(PLAYERS, file), code);
    state.players[p] = { solver: tag, file: 'players/' + file, at: new Date().toISOString() };
    delete state.failed[p];
    console.log('Prepared ' + p + ' with ' + tag + ': players/' + file + ' (' + code.length + ' bytes)');
}

async function main() {
    const state = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : {};
    state.players = state.players || {};
    state.failed = state.failed || {};
    let paths;
    let tag;
    try {
        [paths, tag] = await Promise.all([players(), latestSolver()]);
    } catch (e) {
        // Most often a passing network failure: the next run asks again
        console.log('::warning::Could not check: ' + e.message);
        return;
    }
    const now = Date.now();
    const todo = paths.filter((p) => {
        const done = state.players[p];
        const failed = state.failed[p];
        return force || !(done && done.solver === tag) && !(failed && failed.solver === tag && now - Date.parse(failed.at) < RETRY_MS);
    });
    if (process.env.GITHUB_OUTPUT) {
        fs.appendFileSync(process.env.GITHUB_OUTPUT, 'todo=' + (todo.length ? 'yes' : '') + '\n');
    }
    if (!todo.length) {
        console.log('Nothing to do: ' + paths.join(', ') + ' with ' + tag);
        return;
    }
    if (checkOnly) {
        console.log('To prepare with ' + tag + ': ' + todo.join(', '));
        return;
    }
    const solve = await solver(tag);
    const failures = [];
    const told = [];
    for (const p of todo) {
        try {
            await prepare(p, tag, solve, state);
            told.push(fileOf(p));
        } catch (e) {
            state.failed[p] = { solver: tag, at: new Date().toISOString(), error: String(e.message || e).slice(0, 500) };
            failures.push(p + ': ' + state.failed[p].error);
            told.push(fileOf(p) + ' failed');
        }
    }
    if (process.env.GITHUB_OUTPUT) {
        // The commit's message
        fs.appendFileSync(process.env.GITHUB_OUTPUT, 'summary=' + told.join(', ') + ' (solver ' + tag + ')\n');
    }
    // The newest KEPT stay
    const kept = Object.keys(state.players).sort((a, b) => state.players[b].at.localeCompare(state.players[a].at));
    for (const p of kept.slice(KEPT)) {
        fs.rmSync(path.join(ROOT, state.players[p].file), { force: true });
        delete state.players[p];
    }
    state.solver = tag;
    fs.writeFileSync(STATE, JSON.stringify(state, null, 2) + '\n');
    if (failures.length) {
        // Noted in state.json, so the runs after this one wait for a change instead of failing again
        console.error(failures.join('\n'));
        process.exitCode = 1;
    }
}

main().catch((e) => {
    console.error(e.message || e);
    process.exit(1);
});
