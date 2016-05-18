import Promise from 'bluebird';
import {Bot} from '../bot';
import {isMessage, normalizeMessage} from '../util/response';
import createSlackMessageHandler from './message-handler/slack';
import {parseMessage} from './util/message-parser';

export class SlackBot extends Bot {
  constructor(options = {}) {
    super(options);
    const {slack, name = 'Test Bot'} = options;
    if (!slack) {
      throw new TypeError('Missing required "slack" option.');
    }
    else if (!slack.rtmClient) {
      throw new TypeError('Missing required "slack.rtmClient" option.');
    }
    else if (!slack.rtmClient.dataStore) {
      throw new TypeError('Missing required "slack.rtmClient.dataStore" property.');
    }
    else if (!slack.webClient) {
      throw new TypeError('Missing required "slack.webClient" option.');
    }
    this.name = name;
    this.slack = slack;
    this.overrideProperties(options);
    this.bindEventHandlers(['open', 'error', 'message']);
  }

  createSlackMessageHandler(...args) {
    return createSlackMessageHandler(this, ...args);
  }

  parseMessage(...args) {
    return parseMessage(this.slack, ...args);
  }

  bindEventHandlers(events) {
    events.forEach(name => {
      const method = this[`on${name[0].toUpperCase()}${name.slice(1)}`];
      if (method) {
        this.slack.rtmClient.on(name, method.bind(this));
      }
    });
  }

  overrideProperties(options) {
    const overrides = [
      'onOpen',
      'onError',
      'onMessage',
      'login',
      'ignoreMessage',
      'getConversationId',
      'postMessage',
      'postMessageOptions',
      'handleResponse',
      'handleResponseError',
    ];
    overrides.forEach(name => {
      if (options[name]) {
        this[name] = options[name];
      }
    });
  }

  onOpen() {
    console.log('Bot connected.');
  }

  onError(...args) {
    console.log('Bot error.', args);
  }

  onMessage(message) {
    if (this.ignoreMessage(message)) {
      return;
    }
    Promise.try(() => {
      const id = this.getConversationId(message);
      return this.getMessageHandler(id).handleMessage(message);
    })
    .then(response => {
      this.handleResponse(message, response);
    })
    .catch(error => {
      this.handleResponseError(message, error);
    });
  }

  login() {
    this.slack.rtmClient.start();
    return this;
  }

  ignoreMessage(message) {
    return message.subtype === 'bot_message';
  }

  getConversationId(message) {
    const channel = this.slack.rtmClient.dataStore.getChannelGroupOrDMById(message.channel);
    return channel.id;
  }

  postMessage(message, response) {
    const channel = this.slack.rtmClient.dataStore.getChannelGroupOrDMById(message.channel);
    const text = isMessage(response) ? normalizeMessage(response) :
      isMessage(response.message) ? normalizeMessage(response.message) :
      null;
    const meta = {message, response, channel};
    return this.slack.webClient.chat.postMessage(channel.id, text, this.postMessageOptions(text, meta));
  }

  postMessageOptions(text) {
    return {
      username: this.name,
      text,
      unfurl_links: false,
      unfurl_media: false,
    };
  }

  handleResponse(message, response) {
    if (response === false) {
      return;
    }
    this.postMessage(message, response);
  }

  handleResponseError(message, error) {
    console.error(error.stack);
    this.postMessage(message, `An error occurred: \`${error.message}\``);
  }

}

export default function createSlackBot(options) {
  return new SlackBot(options);
}
