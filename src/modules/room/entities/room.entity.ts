import {Router} from "mediasoup/node/lib/Router";

export class RoomEntity {

    public adminSocketId: string = "";

    public roomSocketId: Array<string> = new Array<string>();

    public router?: Router;
}