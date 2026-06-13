#!/usr/bin/env node

const { Command } = require('commander');
const { version } = require('../package.json');

const program = new Command();

program
	.name('kit')
	.description('Haptiq toolkit for consistent project builds')
	.version(version);

program.parse();