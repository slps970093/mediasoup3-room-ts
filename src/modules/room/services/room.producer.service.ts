import {RoomProducerEntity} from "../entities/RoomProducer.entity";
import {Producer} from "mediasoup/node/lib/Producer";

export class RoomProducerService {

    private pool: Map<string,RoomProducerEntity> = new Map();

    private static instance: RoomProducerService;

    private constructor() {}

    public static getInstance(): RoomProducerService {
        if (!RoomProducerService.instance) {
            RoomProducerService.instance = new RoomProducerService();
        }

        return RoomProducerService.instance;
    }

    public putRoomProducer(roomId: string, socketId: string, producer: Producer) {
        let roomEntity = new RoomProducerEntity();

        if (this.pool.has(roomId)) {
            // @ts-ignore
            roomEntity = this.pool.get(roomId);
        }

        roomEntity.producer.set(socketId, producer);

        this.pool.set(roomId,roomEntity);
    }

    public exist(roomId: string) {
        return this.pool.has(roomId);
    }


    public get(roomId: string) {
        return this.pool.get(roomId);
    }

    public removeRoomSocketMember(roomId: string, socketId: string) {
        if (this.pool.has(roomId)) {
            let roomEntity = this.pool.get(roomId);
            // @ts-ignore
            roomEntity.producer.delete(socketId);
            // @ts-ignore
            this.pool.set(roomId,roomEntity);
        }
    }
}