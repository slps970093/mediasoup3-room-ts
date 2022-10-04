import {RoomEntity} from "../entities/room.entity";


export class RoomPool {

    private static instance: RoomPool;

    private pool: Map<String, RoomEntity>;

    private constructor() {
        this.pool = new Map<String, RoomEntity>();
    }

    public static getInstance(): RoomPool {
        if (!RoomPool.instance) {
            RoomPool.instance = new RoomPool();
        }

        return RoomPool.instance;
    }

    public exist(roomId: string) {
        return this.pool.has(roomId);
    }

    public set(roomId: string, entity: RoomEntity) {
        return this.pool.set(roomId, entity);
    }

    public get(roomId: string) : RoomEntity {
        let roomEntity = this.pool.get(roomId);

        if (typeof roomEntity === "undefined") {
            throw new Error('not found');
        }

        return roomEntity;
    }

    public delete(roomId: string) {
        return this.pool.delete(roomId);
    }

}