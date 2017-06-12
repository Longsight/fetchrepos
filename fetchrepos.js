#!/usr/bin/env node

'use strict';

var fs = require('fs');
var fetch = require('node-fetch');
var Git = require('nodegit');

var opts = {
    fetchOpts: {
        callbacks: {
            certificateCheck: function() { return 1; },
            credentials: function(url, userName) {
                return Git.Cred.sshKeyFromAgent(userName);
            }
        }
    }
};

var config;
try {
    config = require('./config.json');
} catch (ex) {
    console.error('Unable to read config, exiting');
    process.exit(1);
}
var repos = fetch('https://api.github.com/orgs/' + config.org + '/repos?access_token=' + config.token + '&type=all&per_page=100').then(function(res) {
    return res.json();
}).then(function(repos) {
    for (var i = 0; i < repos.length; i++) {
        var r = repos[i];
        var path = './repos/' + r.name;
        if (!fs.existsSync(path)) {
            console.log('Cloning ' + r.name);
            Git.Clone(r.ssh_url, path, opts);
        } else {
            console.log('Updating ' + r.name);
            Git.Repository.open(path).then(function(repo) {
                return Promise.all([repo, repo.fetch('origin', opts.fetchOpts)]);
            }).then(function(repo) {
                repo.push(repo[0].getCurrentBranch());
                return Promise.all(repo);
            }).then(function(repo) {
                repo.push(Git.Branch.upstream(repo[2]));
                return Promise.all(repo);
            }).then(function(repo) {
                repo.push(repo[0].mergeBranches(repo[2], repo[3], 0, Git.Merge.PREFERENCE.FASTFORWARD_ONLY));
                return Promise.all(repo);
            }).catch(function(e) {
                console.log(r.name + ': ' + e);
                return null;
            });
        }
    }
});
