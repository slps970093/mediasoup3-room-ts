import {MemberEntity} from "../entities/member.entity";
import {MemberNotFound} from "./errors/MemberNotFound";

export class MemberPool {

    private static instance: MemberPool;

    private pool: Map<String, MemberEntity>;

    private constructor() {
        this.pool = new Map<String, MemberEntity>();
    }

    public static getInstance() : MemberPool {
        if (!MemberPool.instance) {
            MemberPool.instance = new MemberPool();
        }
        return MemberPool.instance;
    }

    public set(memberId: string, entity: MemberEntity) {
        this.pool.set(memberId,entity);
    }

    public get(memberId: string) : MemberEntity {
        let entity = this.pool.get(memberId);
        if (typeof entity === 'undefined') {
            throw new MemberNotFound();
        }
        return entity;
    }

    public exist(memberId: string) {
        return this.pool.has(memberId);
    }


    public delete(memberId: string) {
        return this.pool.delete(memberId);
    }

}