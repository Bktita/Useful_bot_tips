import Promise from 'bluebird';
import {processMessage} from '../src';

// Simulate a promise-yielding database abstraction.
const db = {
  query() {
    return new Promise(resolve => {
      const stuff = ['stapler', 'robot', 'another robot', 'piano'];
      setTimeout(() => resolve(stuff), 100);
    });
  },
};

// ================
// message handlers
// ================

// Plain function. Receives a message and returns a value.
const alwaysRespond = message => `You said "${message}".`;

// Plain function. Receives a message and sometimes returns a value, but
// sometimes returns false.
const sometimesRespond = message => {
  if (/lol/i.test(message)) {
    const newMessage = message.replace(/lol/ig, 'laugh out loud');
    return `More like "${newMessage}" amirite`;
  }
  return false;
};

// Array of functions. Messages will be sent through them in order, and the
// first one that returns a non-false value wins!
const multipleResponders = [
  sometimesRespond,
  alwaysRespond,
];

// Object with a handleMessage method. Also returns a promise that yields a
// value.
const respondEventually = {
  handleMessage() {
    return db.query('SELECT * FROM STUFF').then(results => {
      const stuff = results.join(', ');
      return `Look at all the stuff: ${stuff}`;
    });
  },
};

// Object with a handleMessage method. This is basically what you get when you
// use createMatcher (so use that instead). This module's handleMessage
// function is used to iterate over all children.
const matchAndRunChildHandlers = {
  match: 'yo',
  children: [
    sometimesRespond,
    alwaysRespond,
  ],
  getMatchRemainder(message) {
    if (message.indexOf(this.match) !== 0) {
      return false;
    }
    return message.slice(this.match.length).replace(/^\s+/, '');
  },
  handleMessage(message) {
    const remainder = this.getMatchRemainder(message);
    if (remainder === false) {
      return false;
    }
    return handleMessage(this.children, remainder);
  },
};


// ================
// handle messages!
// ================

function header(message) {
  console.log(`\n${message}`);
}

function simulate(messageHandler, message) {
  console.log('[In]', message);
  return processMessage(messageHandler, message).then(response => {
    if (response === false) {
      console.log('-');
    }
    else {
      console.log('[Out]', response);
    }
  });
}

Promise.mapSeries([
  () => header('alwaysRespond'),
  () => simulate(alwaysRespond, 'hello'),
  () => simulate(alwaysRespond, 'world'),
  () => header('sometimesRespond'),
  () => simulate(sometimesRespond, 'hello'),
  () => simulate(sometimesRespond, 'lol world'),
  () => header('multipleResponders'),
  () => simulate(multipleResponders, 'hello'),
  () => simulate(multipleResponders, 'lol world'),
  () => header('respondEventually'),
  () => simulate(respondEventually, ''),
  () => header('matchAndRunChildHandlers'),
  () => simulate(matchAndRunChildHandlers, 'not yo'),
  () => simulate(matchAndRunChildHandlers, 'yo'),
  () => simulate(matchAndRunChildHandlers, 'yo hello'),
  () => simulate(matchAndRunChildHandlers, 'yo lol world'),
], f => f());
