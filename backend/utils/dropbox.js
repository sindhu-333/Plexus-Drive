//const fetch = require('node-fetch'); // import fetch
const { Dropbox } = require('dropbox');
const fs = require('fs');

// Use env var directly; fall back to dropbox_token.txt for local dev
let refreshToken = process.env.DROPBOX_REFRESH_TOKEN;
if (!refreshToken) {
    try {
        let tokenContent = fs.readFileSync('./dropbox_token.txt', 'utf8').trim();
        refreshToken = tokenContent.startsWith('REFRESH_TOKEN=')
            ? tokenContent.split('=')[1]
            : tokenContent;
    } catch (e) {
        throw new Error('DROPBOX_REFRESH_TOKEN env var not set and dropbox_token.txt not found');
    }
}

const dbx = new Dropbox({
    refreshToken: refreshToken,
    clientId: process.env.DROPBOX_APP_KEY,
    clientSecret: process.env.DROPBOX_APP_SECRET,
    fetch // pass fetch to Dropbox
});

async function uploadFile(filename, buffer) {
    try {
        const response = await dbx.filesUpload({
            path: '/' + filename,
            contents: buffer
        });
        return response.result.path_lower; // or path_display
    } catch (err) {
        console.error('Dropbox upload error:', err);
        throw err;
    }
}

async function deleteFile(path) {
    try {
        await dbx.filesDeleteV2({ path });
    } catch (err) {
        console.error('Dropbox delete error:', err);
        throw err;
    }
}

// Upload file and return a permanent public direct-link URL
async function uploadFileAndGetUrl(dropboxPath, buffer) {
    // Upload the file
    await dbx.filesUpload({
        path: dropboxPath,
        contents: buffer,
        mode: { '.tag': 'overwrite' }
    });

    // Create (or retrieve) a shared link
    let sharedLink;
    try {
        const res = await dbx.sharingCreateSharedLinkWithSettings({ path: dropboxPath });
        sharedLink = res.result.url;
    } catch (err) {
        // Link already exists — fetch it
        if (err.error && err.error['.tag'] === 'shared_link_already_exists') {
            const existing = await dbx.sharingListSharedLinks({ path: dropboxPath, direct_only: true });
            sharedLink = existing.result.links[0].url;
        } else {
            throw err;
        }
    }

    // Convert to a direct image URL (dl=1 forces raw content)
    return sharedLink.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('?dl=0', '').replace('?raw=1', '') + '?raw=1';
}

module.exports = { uploadFile, deleteFile, uploadFileAndGetUrl };
