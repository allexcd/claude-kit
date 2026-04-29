#!/usr/bin/env node
'use strict';

const { main } = require('../src/cli');

main(process.argv.slice(2)).catch((error) => {
  console.error(`\n  ERROR: ${error.message || error}\n`);
  process.exit(1);
});
