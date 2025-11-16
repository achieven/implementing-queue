import { getRandomInt, sleep } from "./Util";

import {  Message } from "./Database";

export class Queue {
    private messages: Message[]
    private itemsBusy: string[]

    constructor() {
        this.messages = []
        this.itemsBusy = []
    }

    Enqueue = (message: Message) => {
        this.messages.push(message)
    }

    Dequeue = async (workerId: number): Promise<Message | undefined> => {
        const message = this.messages.splice(0,1)[0]
        if (!message) {
            return undefined
        }
        while (this.itemsBusy.includes(message.key)) {
            await sleep(getRandomInt(10))
        }
        this.itemsBusy.push(message.key)
        return message
    }
    Confirm = (workerId: number, messageId: string) => {
        const messageKey = messageId.split(':')[0]
        this.itemsBusy = this.itemsBusy.filter(item => item !== messageKey)
    }

    Size = () => {
        return this.messages.length
    }
}