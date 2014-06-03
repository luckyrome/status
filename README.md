status
======

A quick and dirty dashboard/API for things I care about

Right now:
- Backend API
    - Supports JSON and raw Strings (via regex extraction)
    - Couple of examples in config.json
    - memcached support
- Frontend UI
    - Doesn't exist

To Deploy:
- Backend API
    - `cd ./backend/ && npm install && node ./statuschecker.js`
- Frontend UI
    - Nothing yet. Probably something magical with symlinking at some point :)

Testing:
- Coming soon!