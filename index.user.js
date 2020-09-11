// ==UserScript==
// @name         Cheerz Archiver
// @namespace    @tomouchuu
// @version      1.0.0
// @description  Goes through each item on the page and saves the image+voice where possible
// @author       tomo@uchuu.io // https://twitter.com/tomouchuu
// @match        *://cheerz.cz/artist/*
// @require      https://greasemonkey.github.io/gm4-polyfill/gm4-polyfill.js
// @grant        GM_addStyle
// @grant        GM_download
// ==/UserScript==
(function() {
    // Get and download the audio
    function getAudio(itemId, title, date) {
        return new Promise((resolve, reject) => {
            const audio = document.querySelector('audio').src;
            GM_download({
                url: audio,
                name: `${itemId}/${date}_${title}.m4a`,
                onerror: reject,
                onload: resolve
            });
        });
    }

    // Get and download the image
    function getImage(itemId, title, date) {
        return new Promise((resolve, reject) => {
            const image = document.querySelector('.photo > img').src;
            GM_download({
                url: image,
                name: `${itemId}/${date}_${title}.jpg`,
                onerror: reject,
                onload: resolve
            });
        });
    }

    // Get an item with specific index
    function getItem(items, index) {
        const archiveBtn = document.querySelector('.archive-btn');
        archiveBtn.textContent = `Getting ${index}/${items.length}`;

        const item = items[index];
        const id = item.dataset.itemId;
        const title = item.querySelector('.itemBottom > .comment').innerText;
        const uploadTime = item.querySelector('.itemBottom > .date').innerText;
        const date = uploadTime.replace(/\./g, '');
        const modalLink = item.querySelector('a.modal');

        modalLink.click();
        setTimeout(() => {
            // Get image & audio
            getImage(id, title, date).then(() => {
                getAudio(id, title, date).then(() => {
                    // Click the close button
                    document.querySelector('button.buttonFirst.closeButton').click();
                    setTimeout(() => {
                        const nextIndex = index + 1;
                        // if (nextIndex >= items.length) {
                        if (nextIndex >= 2) { // Set to 2 for testing
                            archiveBtn.textContent = 'Complete';
                        } else {
                            getItem(items, nextIndex);
                        }
                    }, 5000);
                });
            });
        }, 4000);
    }

    // Start the Archive (1s delay to make sure feed is loaded)
    function startArchive() {
        setTimeout(() => {
            const items = document.querySelectorAll('.feed > .item');
            getItem(items, 0);
        }, 1000);
    }

    // Archive Button Setup
    GM_addStyle('.archive-btn {background-color: #fff; position: absolute; top: 15px; right: 15px; transition: all 0.2s; z-index: 100000;} .archive-btn:hover {background-color: #f38ec3; color: #fff; opacity: 1; transition: all 0.2s;} .archive-btn-on-modal {right: 75px;}');
    const archiveBtn = document.createElement('button');
    archiveBtn.classList.add('btn', 'large', 'registered', 'archive-btn');
    archiveBtn.textContent = 'Archive Posts';
    archiveBtn.addEventListener('click', e => {
        e.preventDefault();
        archiveBtn.classList.add('archive-btn-on-modal');
        startArchive();
    });
    document.querySelector('.artistCover').appendChild(archiveBtn);
})();