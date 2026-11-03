# Bolli Solver

Keeps [Bolli YouTube](https://github.com/aktiwers/bolli-youtube) able to play age-restricted and members-only videos when YouTube changes its player.

For those videos, YouTube's servers want a code in the stream address that YouTube's own player script works out, and YouTube changes that script all the time. [yt-dlp's solver](https://github.com/yt-dlp/ejs) knows how to work it out for any version.

Every 5 minutes a job here checks which player script YouTube's TV app uses and whether yt-dlp has a new solver. Only when something changed, it runs the solver, turns the small piece of code it makes into JavaScript a 2017 TV understands, checks on a simulated old TV that it gives the same answers, and saves it in `players/`. When Bolli YouTube can't work the code out by itself, it fetches it from here, so it keeps working without an app update.

Nothing from YouTube is stored here, only the solver's code for each player script.

## Thanks

- [yt-dlp/ejs](https://github.com/yt-dlp/ejs) (Unlicense): the solver.
- [Babel](https://babeljs.io) and [acorn](https://github.com/acornjs/acorn): the conversion and the checks.

## License

Unlicense, see [LICENSE](LICENSE).
