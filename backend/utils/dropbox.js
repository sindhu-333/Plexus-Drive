//const fetch = require('node-fetch'); // import fetch
const { Dropbox } = require('dropbox');
const fs = require('fs');

let tokenContent = fs.readFileSync('./dropbox_token.txt', 'utf8').trim();
let refreshToken = tokenContent;

if (tokenContent.startsWith('REFRESH_TOKEN=')) {
    refreshToken = tokenContent.split('=')[1];
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

module.exports = { uploadFile, deleteFile };
