import algoliasearch from 'algoliasearch';
import instantsearch from 'instantsearch.js';
import { searchBox, hits, configure, pagination } from 'instantsearch.js/es/widgets';

import Dom from './helpers/dom';
import mapper from './helpers/forum-mapper';
import * as config from '../config/index';

import "../css/search.css";

(function() {
  class Content {
    constructor() {
      this.create();
    }
    
    async create() {
      chrome.storage.local.get(['currentTab'], (result) => {
        this.currentURL = JSON.parse(result.currentTab).url;
        if (!this.currentURL.includes('forumdisplay')) return;

        const forumId = this.currentURL.split('forumdisplay.php')[1].split('=')[1];
        this.dom = new Dom(document, forumId);
        this.startCrawling();
      });
      this.searchClient = algoliasearch(config.algolia.appId, config.algolia.readKey);
      const indexName = 'shurscador';
      this.index = this.searchClient.initIndex(indexName); 
      
      const url = chrome.extension.getURL('search.html');
      const html = await this.getHTML(url);
      this.injectHTML(html);
      this.initInstantSearch();
    }

    startCrawling() {
      let pinnedThreads = [];
      for (let pinnedThread of this.dom.pinnedThreads.children) {
        if (pinnedThread.querySelector('a')) {
          const pinnedThreadInfo = this.dom.getPinnedThreadInfo(pinnedThread);
          pinnedThreads.push(pinnedThreadInfo);
        }
      }
      this.indexPinnedThreads(pinnedThreads);

      let threads = [];
      for (let thread of this.dom.threads.children) {
        if (thread.querySelector('a')) {
          const threadInfo = this.dom.getThreadInfo(thread);
          threads.push(threadInfo);
        }
      }
      this.indexThreads(threads);
      return;
    }

    async indexPinnedThreads(pinnedThreads) {
      const algoliaObjects = pinnedThreads.map((pinnedThread) => {
        return {
          ...pinnedThread,
          type: 'pinnedThread',
          forumName: mapper.getForumName(parseInt(pinnedThread.forumId, 10)),
          lastSeen: new Date(),
        }
      });
      var headers = new Headers();
      headers.append('Content-Type', 'application/json');
      const indexResponse = await fetch(`${config.api.baseUrl}/index/thread`, {
        method: 'post',
        body: JSON.stringify(algoliaObjects),
        headers,
      });
    }

    async indexThreads(threads) {
      const algoliaObjects = threads.map((thread) => {
        return {
          ...thread,
          type: 'thread',
          forumName: mapper.getForumName(parseInt(thread.forumId, 10)),
          lastSeen: new Date(),
        }
      });
      var headers = new Headers();
      headers.append('Content-Type', 'application/json');
      const indexResponse = await fetch(`${config.api.baseUrl}/index/thread`, {
        method: 'post',
        body: JSON.stringify(algoliaObjects),
        headers,
      });
    }

    searchFunction(helper) {
      if (helper.getState().query === '') {
        if (document.querySelector('.ais-Hits')) {
          document.querySelector('.ais-Hits').remove();
          document.querySelector('.ais-Pagination').remove();
        }
        return;    
      } else {
        helper.search();
      }
    }
  
    async getHTML(url = null) {
      const response = await fetch(url);
      return await response.text();
    }
  
    injectHTML(html = null) {
      const body = document.body;
      const wrapper = document.createElement('div');
      wrapper.classList.add('page-wrapper');
      wrapper.innerHTML = body;
      document.body.innerHTML = `<div class="page-wrapper">${body.innerHTML}</div>`;
      const firstChild = body.childNodes[0];
      const searchRoot = document.createElement('div');
      searchRoot.innerHTML = html;
      return body.insertBefore(searchRoot, firstChild);
    }

    initInstantSearch() {
      const search = instantsearch({
        indexName: 'shurscador',
        routing: false,
        searchClient: this.searchClient,
        searchFunction: this.searchFunction,
      });
    
      // initialize SearchBox
      search.addWidget(
        searchBox({
          container: '#search-box',
          placeholder: 'Puedes buscar por hilo, respuesta o usuario',
        }),
      );

      // initialize hits widget
      search.addWidget(
        hits({
          container: '#hits',
          templates: {
            item:
              `
                <div>
                  ✉️
                  <a href="https://www.forocoches.com/foro/forumdisplay.php?f={{forumId}}" target="_blank">{{forumName}}</a>
                  >
                  <a href="{{link}}" target="_blank">{{#helpers.highlight}}{ "attribute": "title" }{{/helpers.highlight}} </a>
                </div>
              `
          },
          escapeHTML: true,
        }),
      );

      search.addWidget(
        pagination({
          container: '#pagination',
        }),
      );

      search.addWidget(
        configure({
          hitsPerPage: 10,
        }),
      );
      
      search.start();
    }

  }

  new Content();
})();
