// Run "npm install" and then test with this command in your shell:
// SLACK_API_TOKEN=<YOUR_TOKEN_HERE> npm run babel examples/slack.js
//
// Note that you'll first need a Slack API token, which you can get by going
// to your team's settings page and creating a new bot:
// https://my.slack.com/services/new/bot

import Promise from 'bluebird';
import {RtmClient, WebClient, MemoryDataStore} from '@slack/client';
import {
  createSlackBot,
  createConversation,
  createCommand,
  createMatcher,
  createParser,
} from '../src';

// Respond to the word "hello"
const helloHandler = message => {
  if (/hello/i.test(message)) {
    return `Hello to you too!`;
  }
  return false;
};

// Respond to the word "lol"
const lolHandler = message => {
  if (/lol/i.test(message)) {
    const newMessage = message.replace(/lol/ig, 'laugh out loud');
    return `More like "${newMessage}" amirite`;
  }
  return false;
};

// A command that says something after a delay. Be careful, though! Even though
// this command yields false to indicate when it doesn't know how to handle the
// message, it does so after the delay. If possible, return false immediately!
const delayCommand = createCommand({
  name: 'delay',
  description: `I'll say something after a delay.`,
  usage: '[yes | no]',
}, message => {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(!message ? false : message.toLowerCase() === 'yes' ? 'Awesome!' : 'Bummer!');
    }, 250);
  });
});

// A command that echoes user input.
const echoCommand = createCommand({
  name: 'echo',
  description: `I'm the echo command.`,
  usage: '<say anything here>',
}, message => {
  if (message) {
    return `You said *${message}*`;
  }
  return false;
});

// A command that adds some numbers.
const addCommand = createCommand({
  name: 'add',
  description: 'Adds some numbers.',
  usage: 'number [ number [ number ... ] ]',
}, createParser(function({args, message}) {
  if (!message) {
    return false;
  }
  const result = args.reduce((sum, n) => sum + Number(n), 0);
  if (isNaN(result)) {
    return `Whoops! Are you sure those were all numbers?`;
  }
  return `${args.join(' + ')} = ${result}`;
}));


// A command that multiplies some numbers.
const multiplyCommand = createCommand({
  name: 'multiply',
  description: 'Multiplies some numbers.',
  usage: 'number [ number [ number ... ] ]',
}, createParser(function({args, message}) {
  if (!message) {
    return false;
  }
  const result = args.reduce((product, n) => product * Number(n), 1);
  if (isNaN(result)) {
    return `Whoops! Are you sure those were all numbers?`;
  }
  return `${args.join(' x ')} = ${result}`;
}));

// Math commands.
const mathCommand = createCommand({
  name: 'math',
  description: `Math-related commands.`,
}, [
  addCommand,
  multiplyCommand,
]);

// The bot.
const bot = createSlackBot({
  // The bot name.
  name: 'Test Bot',
  // Instances of the slack rtm and web client, per
  // https://github.com/slackhq/node-slack-sdk
  getSlack() {
    return {
      rtmClient: new RtmClient(process.env.SLACK_API_TOKEN, {
        dataStore: new MemoryDataStore(),
        autoReconnect: true,
        logLevel: 'error',
      }),
      webClient: new WebClient(process.env.SLACK_API_TOKEN),
    };
  },
  // Whenever a new message comes in, it'll be handled by what this returns.
  // If a stateful message handler is used (like a conversation), it will
  // be cached.
  createMessageHandler(id, {channel}) {
    // Direct message
    if (channel.is_im) {
      return createConversation([
        // Nameless top-level command.
        createCommand({
          isParent: true,
          description: `Hi, I'm the test bot!`,
        }, [
          delayCommand,
          echoCommand,
          mathCommand,
        ]),
      ]);
    }
    // Public channel
    return createConversation([
      // In public, top-level command(s) should really be namespaced.
      createCommand({
        name: 'bot',
        isParent: true,
        description: `Hi, I'm the test bot!`,
      }, [
        delayCommand,
        echoCommand,
        mathCommand,
      ]),
      // Non-command message handlers.
      helloHandler,
      lolHandler,
    ]);
  },
});

// Connect!
bot.login();
