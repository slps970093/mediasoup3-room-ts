import {Socket} from "socket.io";
import {Producer} from "mediasoup/node/lib/Producer";
import {WebRtcTransport} from "mediasoup/node/lib/WebRtcTransport";


export class MemberEntity {

    public socket?: Socket;

    public roomId: string = "";

    public producerTransport: Map<string,WebRtcTransport> = new Map<string, WebRtcTransport>();

    public consumerTransport: Map<string,WebRtcTransport> = new Map<string, WebRtcTransport>();

    public producer?: Producer;

}