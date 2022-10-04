import {Producer} from "mediasoup/node/lib/Producer";

export class RoomProducerEntity {
    public producer: Map<string,Producer> = new Map();
}