import Promise from 'bluebird';
import createMatcher, {MatchingMessageHandler} from './matcher';

const nop = () => {};

describe('MatchingMessageHandler', function() {

  describe('API', function() {

    it('createMatcher should return an instance of MatchingMessageHandler', function() {
      const matcher = createMatcher({match: 'foo', handleMessage: []});
      expect(matcher).to.be.an.instanceof(MatchingMessageHandler);
    });

    it('should behave like DelegatingMessageHandler', function() {
      expect(() => createMatcher({match: 'foo'}, nop)).to.not.throw();
      expect(() => createMatcher({match: 'foo'})).to.throw(/missing.*message.*handlers/i);
    });

    it('should throw if no match option was specified', function() {
      expect(() => createMatcher(nop)).to.throw(/missing.*match/i);
      expect(() => createMatcher({}, nop)).to.throw(/missing.*match/i);
      expect(() => createMatcher({match: 'foo'}, nop)).to.not.throw();
      expect(() => createMatcher({match() {}}, nop)).to.not.throw();
    });

  });

  describe('handleMessage', function() {

    it('should return a promise that gets fulfilled', function() {
      const matcher = createMatcher({match: 'foo'}, nop);
      return expect(matcher.handleMessage()).to.be.fulfilled();
    });

    it('should only run child handlers on match / should return false on no match', function() {
      let i = 0;
      const handleMessage = () => {
        i++;
        return {message: 'yay'};
      };
      const matcher = createMatcher({match: 'foo', handleMessage});
      return Promise.mapSeries([
        () => expect(matcher.handleMessage('foo')).to.become({message: 'yay'}),
        () => expect(matcher.handleMessage('bar')).to.become(false),
        () => expect(i).to.equal(1),
      ], f => f());
    });

    it('should support string matching / should trim leading space from the remainder', function() {
      const handleMessage = (remainder, arg) => ({message: `${remainder} ${arg}`});
      const matcher = createMatcher({match: 'foo', handleMessage});
      return Promise.all([
        expect(matcher.handleMessage('foo bar', 1)).to.become({message: 'bar 1'}),
        expect(matcher.handleMessage('foo    bar', 1)).to.become({message: 'bar 1'}),
      ]);
    });

    it('should support function matching / should pass message and additional arguments into match fn', function() {
      const match = (message, arg) => {
        const [greeting, remainder] = message.split(' ');
        return greeting === 'hello' ? `the ${remainder} is ${arg}` : false;
      };
      const handleMessage = (remainder, arg) => ({message: `${remainder}, ${arg}`});
      const matcher = createMatcher({match, handleMessage});
      return Promise.all([
        expect(matcher.handleMessage('hello world', 'me')).to.become({message: 'the world is me, me'}),
        expect(matcher.handleMessage('hello universe', 'me')).to.become({message: 'the universe is me, me'}),
        expect(matcher.handleMessage('goodbye world', 'me')).to.become(false),
        expect(matcher.handleMessage('goodbye universe', 'me')).to.become(false),
      ]);
    });

    it('should reject if the match option is invalid', function() {
      const matcher = createMatcher({match: 123, handleMessage() {}});
      return expect(matcher.handleMessage('foo')).to.be.rejectedWith(/invalid.*match/i);
    });

    it('should reject if the match function throws an exception', function() {
      const match = message => { throw new Error(`whoops ${message}`); };
      const matcher = createMatcher({match, handleMessage() {}});
      return expect(matcher.handleMessage('foo')).to.be.rejectedWith('whoops foo');
    });

  });

});
