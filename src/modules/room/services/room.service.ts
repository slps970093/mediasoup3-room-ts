import {RoomPool} from "../pools/room.pool";
import {RoomEntity} from "../entities/room.entity";
import e from "cors";

export class RoomService {

    private roomPool: RoomPool;

    public constructor(pool: RoomPool) {
        this.roomPool = pool;
    }

    public exist(roomId: string) {
        return this.roomPool.exist(roomId);
    }

    public joinRoom(roomId: string, memberId: string) : RoomEntity {
        let isExistRoom = this.roomPool.exist(roomId);
        let entity: RoomEntity = new RoomEntity();
        if (isExistRoom) {
            entity = this.roomPool.get(roomId);
        }

        if (entity.adminSocketId == "") {
            entity.adminSocketId = memberId;
        }

        entity.roomSocketId.push(memberId);

        this.roomPool.set(roomId,entity);

        return entity;
    }

    public set(roomId: string, entity: RoomEntity) {
        return this.roomPool.set(roomId,entity);
    }

    public get(roomId: string): RoomEntity {
        return this.roomPool.get(roomId);
    }

    public leaveRoomMember(roomId: string, memberId: string) {
        let isExistRoom = this.roomPool.exist(roomId);

        if (!isExistRoom) {
            return true;
        }

        let entity = this.roomPool.get(roomId);

        entity.roomSocketId.filter((item) => {
            return item == memberId;
        })

        if (entity.adminSocketId == memberId && entity.roomSocketId.length <= 1) {
            this.roomPool.delete(roomId);
        }

        return true;
    }
}