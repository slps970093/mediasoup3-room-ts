/**
 * MediaSoup Socket IO
 */
import { httpServer as MediaSoupServer } from "./servers/mediasoup.server";
import * as dotenv from 'dotenv';

dotenv.config()

const ENV_WEB_SERVER_PORT = (typeof process.env.WEB_SERVER_PORT == "undefined") ?
    80 : parseInt(process.env.WEB_SERVER_PORT);

new Promise(async function (resolve, reject) {
    MediaSoupServer.listen(8888);

    console.log(`mediasoup server is start! http://localhost:${ENV_WEB_SERVER_PORT}`)
})