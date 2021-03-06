
/**
 * Your credentials should be in a file called credentials.json.
 * The file can should have username and password and optionally
 * oauth credentials.
 *
 * The oauth can be left out entirely. If so, oauth authorization
 * will not be tested. If provided, the oauth credentials include
 * the following:
 *
 * - consumerKey: a consumer key for your app
 * - consumerSecret: a consumer secret for your app
 * - accessToken: access token for the current user
 * - accessTokenSecret: access token secret for the current user
 * - requestTokenURL (optional): request token URL
 * - accessTokenURL (optional): access token URL
 * - authorizeURL (optional): authorization URL
 *
 * The format of the credentials json is like so:
 *
 *
 * { "username": 'polotek',
 *   "password": 'NiceTryBuddy',
 *   "oauth": { "consumerKey": "your_consumer_key",
 *            "consumerSecret" : "your_consumer_secret",
 *            "accessToken": "access_token_for_this_user",
 *            "accessTokenSecret": "access_secret_for_this_user",
 *            "requestTokenURL" : "http://api.twitter.com/oauth/request_token",
 *            "accessTokenURL" : "http://api.twitter.com/oauth/access_token",
 *            "authorizeURL" : "https://api.twitter.com/oauth/authorize"}
 * }
 *
 */

function errToString(err, noStack) {
    if(!err) return '';

    if(err.statusCode && err.data) {
        if(err.data.match(/^\s*(\{|\[)/)) {
            var data = JSON.parse(err.data);
            err = new Error(data.error + ' (' + err.statusCode + '): ' + data.request);
        } else {
            err = new Error( '(' + err.statusCode + '): ' + err.data );
        }
        noStack = true;
    }

    return (err.name ? err.name + ': ' : '') +
           (err.message ? err.message + '\n' : '') +
           ( (!noStack && err.stack) ? err.stack : '');
}

function handler(name) {
    return function(err, data, res) {
        try {
            if(err) throw err;
            assert.ok(data && (_.isArray(data) ? !!data.length : true));
        } catch(e) {
            console.error('<Twitter.' + name + '>\n', errToString(e), '\n\n\n');
        }
    }
}

function batch(tests, opts) {
    opts = opts || {};
    opts.batchSize = opts.batchSize || 1;
    opts.batchInt = opts.batchInt || 1000;
    for(var i=0; i < opts.batchSize; i++) {
        try {
            tests[i]();
        } catch(e) {
            console.error(errToString(e), '\n\n\n');
        }
    }

    tests = _.rest(tests, i);
    if(tests.length) {
        setTimeout(function() {
                       batch(tests, opts );
                   }, opts.batchInt);
    }
}

var util = require('util')
    , fs = require('fs')
    , assert = require('assert')
    , _ = require('../lib/underscore')._
    , et = require('../lib/evented-twitter');

var creds = JSON.parse(fs.readFileSync(__dirname + '/credentials.json'))
    , oauth = creds.oauth;

assert.ok(creds);
assert.ok(creds.oauth);

creds.oauth.auth = 'oauth';

var data
    , tweet
    , p;

var t = new et.Twitter(creds);

function testTimeline() {
    t.publicTimeline('json', null, handler('publicTimeline'));

    t.homeTimeline('json', null, handler('homeTimeline'));

    t.friendsTimeline('json', null, handler('friendsTimeline'));

    t.userTimeline('json', null, handler('friendsTimeline'));

    t.mentions('json', null, handler('friendsTimeline'));

    t.retweetedByMe('json', null, handler('retweetedByMe'));

    t.retweetedToMe('json', null, handler('retweetedToMe'));

    t.retweetsOfMe('json', null, handler('retweetsOfMe'));
}

function testUser() {
    t.showUser('json', { screen_name: 'polotek' }, handler('showUser'));

    t.lookup('json', { screen_name: 'polotek' }, handler('lookup'));

    t.search('json',  { q: 'polotek' }, handler('search'));

    t.suggestions('json', null, handler('suggestions'));

    t.suggestionsCategory('json', { category: 'twitter' }, handler('suggestionsCategory'));

    t.profileImage('json', {screen_name:'phonyacct'}, function(err, data, res) {
        if(err) {
            if(!err.statusCode || err.statusCode !== 302)
                return handler('profileImage')(err, data, res);
        }
    });

    t.friends('json', null, handler('friends'));

    t.followers('json', null, handler('followers'));
}

function testTweet() {
    var rand = Math.floor(Math.random() * 1000);

    t.showStatus('json', { id: '30489217779896320' }, handler('showStatus'));

    t.update('json', { status: 'testing evented-twiter ' + rand}, function(err, data, res) {
        if(err) handler('update')(err, data, res);

        var data = JSON.parse(data);
        setTimeout(function() {
            t.retweet('json', {id: data.id_str}, handler('retweet'));
        });

        setTimeout(function() {
            t.destroy('json', {id: data.id_str}, handler('destroy'));
        }, 100);
    });


    t.retweets('json', { id: '30333475600998400' }, handler('retweets'));

    t.retweetedBy('json', { id: '30333475600998400' }, handler('retweetedBy'));

    t.retweetedByIds('json', { id: '30333475600998400' }, handler('retweetedByIds'));
}

function testAccount() {
    t.rateLimitStatus('json', null, handler('rateLimitStatus'));
}

function testDM() {
    t.directMessages('json', null, handler('directMessages'));

    t.directMessagesSent('json', null, handler('directMessagesSent'));

    t.directMessagesNew('json', {screen_name:'polotek', text:'hello!'}, function(err, data, res) {

        if(err) handler('directMessagesNew')(err, data, res);

        var data = JSON.parse(data);
        setTimeout(function() {
            t.directMessagesDestroy('json', {id: data.id_str}, handler('directMessagesDestroy'));
        }, 1000);
    });
}

function testMisc() {
    t.showUser('json', null, function(err, data, res) {
        assert.ok(err);
        var url = 'http://api.twitter.com/1/users/show.json';
        assert.equal(url, err.et.url, 'Errors should contain the url that was requested');
        //handler('showUser')(err, data, res);
    });
}

batch([ testTimeline, testUser, testTweet, testAccount, testDM, testMisc ], { batchSize: 1 });