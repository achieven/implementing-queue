If it was possible to change the Database.ts file, I would do one change which would make it work:
either:

```
this.data[message.key] = result // moved from below
const randomDelay = getRandomInt(100) 
await sleep(randomDelay)
//this.data[message.key] = result
```
or
```
 set = async (message: Message): Promise<void> => {
        const randomDelay = getRandomInt(100)
        await sleep(randomDelay)
        const current = this.data[message.key] || 0
//.... rest of the function's code
```

Otherwise there's a race condition which prevents the correct results, because the data is not set until the random wait is completed. That is because we added the multiple workers to be allowed concurrently.


What we need is a way to *atomically* change the DB so that each result will be reflected in the state of the DB.
In regular databases there's usually atomic counters which don't need to do a fetch and then update, they do it at once.
We could implemented some kind of CAS, but that's at the DB level, not at the queue level.

So atomic update isn't possible with these constraints, so the solution would be to create some kind of mutex on the key, which is the field that is being race conditioned.
For this, i added a field to the Queue class: itemsBusy, counter.  
the `itemsBusy` is adding and clearing the keys that are currently busy, essentially implementing a mutex on this key

Also, note that because i'm running a while loop, i need to be able to context switch to the Confirm function, so i had to change the signature of the Dequeue to be a promise, and change the worker to await the Dequeue
```
await this.queue.Dequeue(this.workerId)`
```

