import {Worker} from "mediasoup/node/lib/Worker";

export class MediaSoupWorker {
    public static async create(): Promise<Worker> {
        const ENV_RTC_MIN_PORT = ( typeof process.env.RTC_MIN_PORT == "undefined" ) ?
            2000 : parseInt(process.env.RTC_MIN_PORT);
        const ENV_RTC_MAX_PORT = ( typeof process.env.RTC_MAX_PORT == "undefined" ) ?
            2020 : parseInt(process.env.RTC_MAX_PORT);

        let worker = await require('mediasoup').createWorker({
            logLevel : "debug",
            logTags  : [ "ice", "dtls" ],
            rtcMinPort: ENV_RTC_MIN_PORT,
            rtcMaxPort: ENV_RTC_MAX_PORT
        });

        console.log(`worker process id ${worker.pid} rtc port ${ENV_RTC_MIN_PORT} - ${ENV_RTC_MAX_PORT}`);

        worker.on('died', (e:any) => {
            console.error(`e.message`);

            setTimeout(() => process.exit(1), 5000);
        });


        return worker;
    }
}