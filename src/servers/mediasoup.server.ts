import {createServer} from "http";
import {Server} from "socket.io";
import {MemberEntity} from "../modules/member/entities/member.entity";
import {MemberPool} from "../modules/member/pools/member.pool";
import {Worker} from "mediasoup/node/lib/Worker";
import {Router} from "mediasoup/node/lib/Router";
import {Consumer} from "mediasoup/node/lib/Consumer";
import {DtlsParameters, IceCandidate, IceParameters} from "mediasoup/node/lib/WebRtcTransport";
import {MediaSoupWorker} from "../libraries/MediaSoupWorker";
import {RoomPool} from "../modules/room/pools/room.pool";
import {RoomService} from "../modules/room/services/room.service";
import {RoomProducerService} from "../modules/room/services/room.producer.service";
import fetch from 'node-fetch';

const httpServer = createServer((request, response) => {
    if (request.url == '/health') {
        response.writeHead(200, {'Content-Type': 'application/json'})
            .write(JSON.stringify({status: true}))
        response.end()
    }
});

const io = new Server(httpServer, {
    cors: {
        origin: '*'
    }
});

const mediaCodecs = [
    {
        kind: "audio",
        mimeType: "audio/opus",
        clockRate: 48000,
        channels: 2
    },
    {
        kind: "video",
        mimeType: "video/H264",
        clockRate: 90000,
        parameters:
            {
                "packetization-mode": 1,
                "profile-level-id": "42e01f",
                "level-asymmetry-allowed": 1
            }
    }
];

let worker: Worker;
let roomService = new RoomService(RoomPool.getInstance());
let poolMember = MemberPool.getInstance();
let serviceRoomProducer = RoomProducerService.getInstance();
let consumerPool: Array<Consumer>  = [];
const EVENT_SOCKET_IO_BROADCAST_ROOM_PRODUCER = "broadcast-room-producer";

new Promise(async function (resolve, reject) {
    worker = await MediaSoupWorker.create();
})

io.on("connection", async (socket) => {
    // 當第一次連線成功 分配一個使用者ID
    await MediaSoupWorker.create();
    console.log("new connection! socket id:" + socket.id);
    socket.emit("connect-success", {
        socketId: socket.id
    });

    socket.on("disconnect", () => {
        console.log("disconnect");
        let roomId = "";
        // 用戶下線處理
        if (poolMember.exist(socket.id)) {
            roomId = poolMember.get(socket.id).roomId;
            poolMember.delete(socket.id);
            console.log(`user id ${socket.id} disconnect`);
            // 刪除房間發送者資訊
            serviceRoomProducer.removeRoomSocketMember(roomId,socket.id);
        }

        // 房間下線處理
        roomService.leaveRoomMember(roomId, socket.id);
    })

    // 加入房間
    socket.on("joinRoom", async ({roomId}, callback) => {
        console.log(`socket user id: ${socket.id} join room id: ${roomId}`);
        let member = new MemberEntity();
        member.socket = socket;
        member.roomId = roomId;
        poolMember.set(socket.id, member);

        let isFirstCreate: boolean = !roomService.exist(roomId);
        let roomEntity = roomService.joinRoom(roomId,socket.id);// 加入廣播間
        socket.join(roomId);

        if (isFirstCreate) {
            // @ts-ignore
            roomEntity.router = await worker.createRouter({ mediaCodecs });
            roomService.set(roomId,roomEntity);
        }

        // 回傳 RTP Capabilities
        console.log('rtp Capabilities', roomEntity.router?.rtpCapabilities)
        callback(roomEntity.router?.rtpCapabilities);
    })


    // 建立 webrtc transport （發布/接收）用
    socket.on('createWebRtcTransport', async ({consumer}, callback) => {
        console.log(`這是接收者請求嗎？ ${consumer}`);

        // 取得房間資訊
        let member = poolMember.get(socket.id);

        if (poolMember.exist(socket.id)) {

            let room = roomService.get(member.roomId)

            // 為個別用戶建立 webrtc transport 綁定於 router
            // router 建立在房間上 所以發布/接收 都要綁定在同一個 room
            if (room.router instanceof Router) {
                let transport = await createWebRtcTransport(room.router, callback)
                // 為個別用戶加入 transport
                if (poolMember.exist(socket.id)) {
                    let member = poolMember.get(socket.id);
                    if (consumer) {
                        // @ts-ignore
                        member.consumerTransport.set(transport.id, transport);
                    } else {
                        // @ts-ignore
                        member.producerTransport.set(transport.id, transport);
                    }
                    poolMember.set(socket.id, member);
                }
            }
        }
    })

    // transport-connect => producer 專用
    socket.on('transport-connect', async ( {transportId, dtlsParameters }, callback ) => {
        console.log('DTLS PARAMS... ', { dtlsParameters })
        let member = poolMember.get(socket.id);

        let transport = member.producerTransport.get(transportId);

        if (typeof transport !== "undefined") {
            await transport.connect({ dtlsParameters });
            member.producerTransport.set(transport.id, transport);
            poolMember.set(socket.id, member);
        }
    });

    /**
     * produce 專用
     */
    socket.on('transport-produce', async ({ kind, rtpParameters, appData }, callback) => {
        // call produce based on the prameters from the client
        let member = poolMember.get(socket.id);

        for (let transportId in member.producerTransport) {

            let transport = await member.producerTransport.get(transportId);

            if (typeof transport !== "undefined") {
                let producer = await transport.produce({
                    kind,
                    rtpParameters,
                });
                console.log('Producer ID: ', producer.id, producer.kind)

                producer.on('transportclose', () => {
                    console.log('transport for this producer closed ')
                    producer.close()
                })

                // 通知房間的所有人 新的來源已經加入
                socket.to(member.roomId).emit(EVENT_SOCKET_IO_BROADCAST_ROOM_PRODUCER, {
                    producerId: producer.id,
                    memberId: socket.id
                });

                member.producerTransport.set(transportId, transport);

                callback({
                    id: producer.id
                })
            }
        }
    });

    // 取得房間發送者
    socket.on('getProducers', (callback) => {
        let member = poolMember.get(socket.id);
        // @ts-ignore
        let producerList = serviceRoomProducer.get(member.roomId);
        let producers: any[] = [];
        // @ts-ignore
        if (serviceRoomProducer.exist(member.roomId)) {
            // @ts-ignore
            if (producerList.producer.size >= 1) {
                // @ts-ignore
                producerList.producer.forEach( (producer,memberId) => {
                    producers = [ ...producers, { producerId: producer.id, memberId: memberId}];
                })
            }
        }

        callback(producers);
    });

    // transport-connect => consumer 專用
    socket.on("transport-recv-connect", async ({dtlsParameters, consumerTransportId}) => {
        console.log('DTLS PARAMS... ', { dtlsParameters })

        let member = poolMember.get(socket.id);

        let transport = await member.consumerTransport.get(consumerTransportId);

        if (typeof transport != 'undefined') {
            await transport.connect({dtlsParameters})
            member.consumerTransport.set(consumerTransportId, transport);
            poolMember.set(socket.id, member);
        }
    });

    // 接收端
    socket.on("consume", async ({ rtpCapabilities, remoteProducerId, consumerTransportId}, callback) => {
        try {
            let member = poolMember.get(socket.id);
            let room = roomService.get(member.roomId);
            let consumerTransport = member.consumerTransport.get(consumerTransportId);
            let isCanConsume = room.router?.canConsume({
                producerId: remoteProducerId,
                rtpCapabilities: rtpCapabilities
            });

            if (isCanConsume) {
                console.log('滿足 canConsume ')
                // @ts-ignore
                let consumer = await consumerTransport.consume({
                    producerId: remoteProducerId,
                    rtpCapabilities,
                    paused: true
                })
                consumer.on('transportclose', () => {
                    console.log('transport close from consumer');
                });

                consumer.on('producerclose', () => {
                    console.log('producer of consumer closed');
                    consumer.close()
                    member.consumerTransport.delete(consumerTransportId);
                    poolMember.set(socket.id, member);

                    // 通知該房間所有用戶 producer 已經下線
                    console.log(`通知 ${remoteProducerId} 下線`)

                    let params = {
                        transportId: consumerTransportId,
                        producerId: remoteProducerId
                    };
                    console.debug(params)
                    broadcastProducerClose(member.roomId,remoteProducerId);
                });

                poolMember.set(socket.id, member);
                consumerPool.push(consumer);

                callback({
                    params: {
                        id: consumer.id,
                        producerId: remoteProducerId,
                        kind: consumer.kind,
                        rtpParameters: consumer.rtpParameters
                    }
                })
                console.log('callback 回去')
            } else {
                console.log('no QQ');
            }
        } catch (e:any) {
            console.log('consumer error!')
            console.log(e.message)
            console.debug(e)
            callback({
                params: {
                    error: e
                }
            })
        }
    })

    socket.on("consume-resume", async ({serverConsumerId}) => {
        console.log('consume resume');
        let consumer = consumerPool.find((item) => {
            return item.id === serverConsumerId;
        })
        if (typeof consumer !== 'undefined') {
            await consumer.resume();
        }
    })
});

const broadcastProducerClose = (roomId:string, producerId: string) => {
    io.to(roomId).emit('broadcast-producer-close', {producerId: producerId});
};

const createWebRtcTransport = async (router: Router,callback: (arg0: { params: { id: string; iceParameters: IceParameters; iceCandidates: IceCandidate[]; dtlsParameters: DtlsParameters; } | { error: unknown; }; }) => void) => {
    try {
        let curlResult = await fetch('ifconfig.me');
        let publicIp = await curlResult.text();

        const webRtcTransportOptions = {
            listenIps: [
                {
                    ip: '0.0.0.0',
                    announcedIp: publicIp    // 這段是關鍵 能不能成功ICE通常都是這裡 （穿越NAT）
                }
            ],
            enableUdp: true,
            enableTcp: true,
            preferUdp: true
        }

        let transport = await router.createWebRtcTransport(webRtcTransportOptions);

        transport.on('dtlsstatechange', state => {
            if (state == 'closed') {
                transport.close()
            }
        });
        transport.on('@close', () => {
            console.log('transport close');
        })
        callback({
            params: {
                id: transport.id,
                iceParameters: transport.iceParameters,
                iceCandidates: transport.iceCandidates,
                dtlsParameters: transport.dtlsParameters
            }
        });
        return transport;

    } catch (e) {
        console.log(`transport error： ${e}`)

        callback({
            params: {
                error: e
            }
        })
    }
}


export { httpServer }