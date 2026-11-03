// Keeps, for each TV player script YouTube uses, the code that computes its n parameter, as yt-dlp's solver
// (github.com/yt-dlp/ejs) makes it, in JavaScript that old TVs run (ES5). For Bolli YouTube: an app that cannot find
// the n transform in the player script itself (YouTube changed it) loads players/<id>/<name>.js and adds it at the
// end of the script's closure (before its last "}).call(this);"), where it sets self.__bolliN.
//
// Each run first checks what YouTube's TV page uses and yt-dlp's latest solver release, and stops if that is done
// already. Else it runs the solver as it is (here, in Node), takes the n code it adds to the player script, turns that
// into ES5 (Babel, plus polyfills.js) and checks it before writing it: it parses as ES5, and in the player script, run
// as a TV's worker would (an old TV's, without the built-ins Chrome 38 lacks by MDN's browser data, for a player script
// made for old TVs), it gives
// the solver's own answers. A failure is noted in state.json and fails the run once; that script is tried again with
// the next solver release (or --force). Network failures only warn: the next run tries again.
//
//   npm run solve                 check, and prepare what changed
//   npm run solve -- --check      only check: prints what changed (needs no packages installed)
//   npm run solve -- --force      prepare again even if nothing changed
// FOUND (comma-separated player script paths) and TAG (the solver release) hand what --check found to the run that
// prepares it, as YouTube's TV page may name another version when asked again.
// (YouTube's TV page sends long headers: package.json raises Node's limit)

import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = import.meta.dirname;
const STATE = path.join(ROOT, 'state.json');
const PLAYERS = path.join(ROOT, 'players');
/** Player scripts kept (the newest) */
const KEPT = 20;
/** The TV browsers YouTube's TV page is asked as: a 2017 LG TV, and a newer one */
const AGENTS = [
    'LG Browser/8.00.00 (webOS.TV-2017), _TV_O18/06.00.25 (LG, OLED55C7V-Z, wired)',
    'Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 WebAppManager'
];
/** A TV player script as YouTube's TV page names it: /s/player/<id>/tv-player….vflset/<name>.js */
const PLAYER_PATH = /\/s\/player\/([\w-]+)\/tv-player[\w-]*\.vflset\/([\w-]+)\.js/;
const WHOLE_PATH = new RegExp('^' + PLAYER_PATH.source + '$');
/** n values the converted code must answer as the solver does */
const CHALLENGES = ['abcdefghijklmnopqrst', 'zyxwvutsrqponmlkjihg', 'Q2xpY2tCYWl0X1Rlc3Q', 'r2D2-c3P0_bb8xy', 'AAAAAAAAAAAAAAAAAAAA'];
/** Where the code goes in the player script: before its closure's end */
const END = '}).call(this);';
/** Bolli YouTube's window stubs for the player script in its worker */
const STUB = 'var window=self,top=self,parent=self;self.document={createElement:function(){return{style:{},setAttribute:function(){},' +
    'appendChild:function(){},getContext:function(){return null}}},documentElement:{style:{}},addEventListener:function(){},' +
    'getElementsByTagName:function(){return[]},querySelector:function(){return null},cookie:"",location:self.location,body:null,head:null};' +
    'var document=self.document;\n';
const force = process.argv.includes('--force');
const checkOnly = process.argv.includes('--check');

/** A failure the next run may not meet: no network, or a busy server */
class Passing extends Error {}

async function get(url, init) {
    const r = await fetch(url, init).catch((e) => {
        throw new Passing(url + ': ' + (e.cause && (e.cause.code || e.cause.message) || e.message));
    });
    if (!r.ok) {
        throw new (r.status >= 500 || r.status === 429 ? Passing : Error)(url + ': ' + r.status);
    }
    return r;
}

/** Hands a value to the workflow's next steps */
function output(name, value) {
    if (process.env.GITHUB_OUTPUT) {
        fs.appendFileSync(process.env.GITHUB_OUTPUT, name + '=' + String(value).replace(/\n/g, ' ') + '\n');
    }
}

/** The player scripts YouTube's TV page loads (their paths) */
async function players() {
    const found = await Promise.all(AGENTS.map(async (agent) => {
        const html = await (await get('https://www.youtube.com/tv', { headers: { 'User-Agent': agent } })).text();
        return (PLAYER_PATH.exec(html) || [])[0];
    }));
    const paths = [...new Set(found.filter(Boolean))];
    if (!paths.length) {
        throw new Error('YouTube\'s TV page names no TV player script');
    }
    return paths;
}

/** yt-dlp's latest solver release */
async function latestSolver() {
    const headers = process.env.GITHUB_TOKEN ? { Authorization: 'Bearer ' + process.env.GITHUB_TOKEN } : {};
    return (await (await get('https://api.github.com/repos/yt-dlp/ejs/releases/latest', { headers })).json()).tag_name;
}

/** Where a player script's code goes: <id>/<name>.js in players/ */
function fileOf(playerPath) {
    const m = WHOLE_PATH.exec(playerPath);
    return m[1] + '/' + m[2] + '.js';
}

/** The solver of a release, as a function of its input */
async function solver(tag) {
    const asset = async (name) => (await get('https://github.com/yt-dlp/ejs/releases/download/' + tag + '/' + name)).text();
    const [lib, core] = await Promise.all([asset('yt.solver.lib.min.js'), asset('yt.solver.core.js')]);
    const ctx = vm.createContext({ console });
    vm.runInContext(lib + '\nthis.meriyah = lib.meriyah; this.astring = lib.astring;', ctx);
    vm.runInContext(core + '\nthis.jsc = jsc;', ctx);
    return ctx.jsc;
}

/** The statement the solver adds at the end of the player script's closure to set _result.n (only it is parsed) */
function nStatement(acorn, prepared) {
    const at = [...prepared.matchAll(/_result\.n\s*=/g)].pop();
    const set = at && acorn.parseExpressionAt(prepared, at.index, { ecmaVersion: 'latest' });
    if (!set || set.type !== 'AssignmentExpression') {
        throw new Error('the solver\'s prepared script sets no _result.n');
    }
    return prepared.slice(set.start, set.end) + ';';
}

/** What old TVs (Chrome 38) lack of the JavaScript built-ins, from MDN's browser data, as expressions to delete */
function newer() {
    const builtins = createRequire(import.meta.url)('@mdn/browser-compat-data').javascript.builtins;
    const missing = (entry) => {
        const s = [].concat(entry.__compat.support.chrome)[0];
        return !s || !!s.flags || s.version_added !== true && s.version_added !== null &&
            !(parseFloat(String(s.version_added).replace('≤', '')) <= 38);
    };
    const out = [];
    for (const [name, entry] of Object.entries(builtins)) {
        const typed = name === 'TypedArray';
        const at = typed ? 'Object.getPrototypeOf(Uint8Array)' : name;
        const object = typed ? Object.getPrototypeOf(Uint8Array) : globalThis[name];
        if (object === undefined || !entry.__compat) {
            continue;
        }
        if (missing(entry)) {
            out.push(name);
            continue;
        }
        for (const [member, sub] of Object.entries(entry)) {
            // Members only (not the entry's notes on behaviour, which are no properties)
            if (!sub.__compat || !missing(sub)) {
                continue;
            }
            if (typeof object === 'function' && object.prototype && member in object.prototype) {
                out.push(at + '.prototype.' + member);
            } else if (member in object) {
                out.push(at + '.' + member);
            }
        }
    }
    return out;
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

/** A context like a TV's worker (an old TV's: without the built-ins old TVs lack) */
function worker(old) {
    function XMLHttpRequest() {}
    XMLHttpRequest.prototype.open = function () {};
    XMLHttpRequest.prototype.send = function () {};
    const ctx = vm.createContext({
        console, URL, Blob, TextEncoder, TextDecoder, atob, btoa, XMLHttpRequest,
        navigator: { userAgent: AGENTS[old ? 0 : 1] },
        location: { href: 'https://www.youtube.com/tv', protocol: 'https:', host: 'www.youtube.com', hostname: 'www.youtube.com',
            origin: 'https://www.youtube.com', pathname: '/tv', search: '', hash: '' },
        setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
        postMessage() {}, addEventListener() {}, removeEventListener() {}, importScripts() {},
        performance: { now: () => 0, timing: {} }
    });
    ctx.self = ctx;
    if (old) {
        vm.runInContext(newer().map((name) => 'delete ' + name + ';').join('\n'), ctx);
    }
    return ctx;
}

/** Throws unless the code parses as ES5 and, in the player script run as a TV's worker would, answers as expected */
function check(acorn, player, code, expected) {
    acorn.parse(code, { ecmaVersion: 5 });
    const end = player.lastIndexOf(END);
    if (end < 0) {
        throw new Error('the player script does not end with ' + END);
    }
    // A player script that is ES5 itself is made for old TVs
    let old = true;
    try {
        acorn.parse(player, { ecmaVersion: 5 });
    } catch (e) {
        old = false;
    }
    const ctx = worker(old);
    vm.runInContext(STUB + player.slice(0, end) + ';' + code + player.slice(end), ctx);
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

/** Prepares one player script with the solver: writes its code, returns its state entry */
async function prepare(p, tag, solve) {
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
    const file = path.join(PLAYERS, fileOf(p));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, code);
    console.log('Prepared ' + p + ' with ' + tag + ': players/' + fileOf(p) + ' (' + code.length + ' bytes)');
    return { solver: tag, at: new Date().toISOString() };
}

async function main() {
    const state = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : { players: {} };
    let paths = (process.env.FOUND || '').split(',').filter((p) => WHOLE_PATH.test(p));
    let tag = process.env.TAG;
    if (!paths.length || !tag) {
        try {
            [paths, tag] = await Promise.all([players(), latestSolver()]);
        } catch (e) {
            // Most often a passing network failure: the next run asks again
            console.log('::warning::Could not check: ' + e.message);
            return;
        }
    }
    const todo = paths.filter((p) => force || (state.players[p] || {}).solver !== tag);
    output('todo', todo.length ? 'yes' : '');
    output('found', paths.join(','));
    output('tag', tag);
    if (!todo.length || checkOnly) {
        console.log((todo.length ? 'To prepare: ' + todo.join(', ') : 'Nothing to do: ' + paths.join(', ')) + ' (solver ' + tag + ')');
        return;
    }
    let solve;
    const failures = [];
    const told = [];
    for (const p of todo) {
        try {
            solve = solve || await solver(tag);
            state.players[p] = await prepare(p, tag, solve);
            told.push(fileOf(p));
        } catch (e) {
            if (e instanceof Passing) {
                console.log('::warning::' + p + ': ' + e.message);
                continue;
            }
            const error = String(e.message || e).slice(0, 500);
            state.players[p] = { solver: tag, at: new Date().toISOString(), error };
            failures.push(p + ': ' + error);
            told.push(fileOf(p) + ' failed');
        }
    }
    output('summary', told.join(', ') + ' (solver ' + tag + ')');
    // The newest KEPT stay
    const kept = Object.keys(state.players).sort((a, b) => state.players[b].at.localeCompare(state.players[a].at));
    for (const p of kept.slice(KEPT)) {
        fs.rmSync(path.join(PLAYERS, fileOf(p)), { force: true });
        delete state.players[p];
    }
    fs.writeFileSync(STATE, JSON.stringify(state, null, 2) + '\n');
    if (failures.length) {
        // Noted in state.json: the runs after this one leave that script until the solver changes
        console.error(failures.join('\n'));
        process.exitCode = 1;
    }
}

main().catch((e) => {
    console.error(e.message || e);
    process.exit(1);
});
