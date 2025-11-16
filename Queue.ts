import { getRandomInt, sleep } from "./Util";

import {  Message } from "./Database";

export class Queue {
    private messages: Message[]
    private itemsBusy: Set<string>

    constructor() {
        this.messages = []
        this.itemsBusy = new Set()
    }

    Enqueue = (message: Message) => {
        this.messages.push(message)
    }

    Dequeue = async (workerId: number): Promise<Message | undefined> => {
        const message = this.messages.splice(0,1)[0]
        if (!message) {
            return undefined
        }
        while (this.itemsBusy.has(message.key)) {
            await sleep(getRandomInt(10))
        }
        this.itemsBusy.add(message.key)
        return message
    }
    Confirm = (workerId: number, messageId: string) => {
        const messageKey = messageId.split(':')[0]
        this.itemsBusy.delete(messageKey)
    }

    Size = () => {
        return this.messages.length
    }
}