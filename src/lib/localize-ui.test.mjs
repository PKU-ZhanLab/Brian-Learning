import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {localizeUI} from '../i18n/ui.js';

test('English localization preserves static sibling content without React key warnings', () => {
  const tree = React.createElement('nav', null,
    React.createElement('button', {title: '解剖探索'}, '解剖探索'),
    React.createElement('button', null, '文献工作台'));
  const errors = [], original = console.error;
  console.error = (...args) => errors.push(args.join(' '));
  let markup;
  try { markup = renderToStaticMarkup(localizeUI(tree, 'en')); }
  finally { console.error = original; }
  assert.equal(markup, '<nav><button title="Anatomy">Anatomy</button><button>Evidence library</button></nav>');
  assert.deepEqual(errors, []);
});

test('localization retains keyed item identity across reorder and protects user prose', () => {
  const item = id => React.createElement('span', {key: id, 'data-id': id}, '解剖探索');
  const localized = ids => localizeUI(ids.map(item), 'en');
  const first = localized(['a', 'b']), second = localized(['b', 'a']);
  assert.equal(first.find(e => e.props['data-id'] === 'a').key, second.find(e => e.props['data-id'] === 'a').key);
  const prose = React.createElement('p', {'data-user-content': true}, '解剖探索');
  assert.equal(localizeUI(prose, 'en'), prose);
  assert.equal(localizeUI(prose, 'zh'), prose);
});

test('Chinese-English-Chinese traversal preserves every research subtree reconciliation key', () => {
  function StatefulResearchWorkspace() { return null; }
  const tree = React.createElement('div', null,
    React.createElement('header', null, '解剖探索'),
    React.createElement('main', null,
      React.createElement(StatefulResearchWorkspace, {key: 'research'}),
      React.createElement('section', null, React.createElement('input', {title: '解剖探索'}))),
    React.createElement('footer', null, '文献工作台'));
  const identities = node => {
    if (Array.isArray(node)) return node.map(identities);
    if (!React.isValidElement(node)) return null;
    return {type: node.type, key: node.key, children: identities(node.props.children)};
  };
  const chinese = localizeUI(tree, 'zh'), english = localizeUI(tree, 'en'), back = localizeUI(tree, 'zh');
  assert.deepEqual(identities(chinese), identities(english));
  assert.deepEqual(identities(english), identities(back));
  assert.match(renderToStaticMarkup(chinese), /解剖探索/);
  assert.match(renderToStaticMarkup(english), /Anatomy/);
  assert.match(renderToStaticMarkup(back), /解剖探索/);
});
