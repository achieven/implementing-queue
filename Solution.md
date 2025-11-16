## Easier solution options:

### Naive solution that doesn't mimic real behaviour:

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

### Identifying the core issue:

Otherwise there's a race condition which prevents the correct results, because the data is not set until the random wait is completed.  
That is because we added the multiple workers to be allowed concurrently.

### Alternative solutions, but are still at the DB level.
What we need is a way to *atomically* change the DB so that each result will be reflected in the state of the DB.  
In regular databases there's usually atomic counters which don't need to do a fetch and then update, they do it at once.  
We could implemented some kind of CAS, but that's at the DB level, not at the queue level.

## Desired solution - implementing mutex

So atomic update isn't possible given these constraints, so the correct solution would be to create some kind of mutex on the key, which is the field that is being race conditioned (different keys are not in race condition with each other).  
For this, i added a field to the Queue class: `itemsBusy`.  
the `itemsBusy` is adding and clearing the keys that are currently busy, trying to essentially implement a mutex on this key.

### Note
1. Out of rush to complete the task with the given time, there are a few issues:  
- Maybe this is related to "over-engineering", but  if we were to take this solution to the real world, and worker implementation would have been a concurrent implemetation such as worker threads, this solution would have not been fully race condition proof, as it's not implementing lock acquisition atomically, because for example 2 workers can might not access the while condition, and both push to the array (which should have been a map/object, see next note), and resolve.  
Ideal solution should use a real Mutex implementation for each item.  
But because workers here are not really asynchronous (only the DB set operation is), and we run a javascript single-thread process, there are no context switches until an async operation occurs.
- Even if not using mutex, using Set/Map/object would have been more performant than array, as it checks the while condition and removes in O(1) complexity.
i.e using Set:
```
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
```
- Even if using array, it's still not performant enough, using the `filter` method, which is usually slower than finding the relevent and remove it (`findIndex` & `splice`).  
That is because it *must* go over the whole elements in the array as well as copying it to a new array, while find & remove also stops the the first index (which in our case will be the only matching index), as well doesn't copy to a new array.  
i.e:
```
const index = this.itemsBusy.findIndex(item => item === messageKey)
if (index !== -1) {
    this.itemsBusy.splice(index, 1)
}
```

2. Because i'm running a while loop, i need to be able to context switch to the Confirm function, so i had to change the signature of the Dequeue to be a promise, and change the worker to await the Dequeue
```
await this.queue.Dequeue(this.workerId)`
```

