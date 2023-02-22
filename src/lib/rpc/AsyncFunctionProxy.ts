import { json } from "stream/consumers"

export class AsyncMessageBus {

    static invocationResult = 'invocationResult'
    static invocationRequest = 'invocationRequest'

}

export class AsyncFunctionProxy {

    name: string 

    invocationId = 0
    invocationRequests: any = {}

    invocationRequestHandler: any = {}

    postMessage: any
    
    constructor(name: string, postMessage: any, messageBus: any) {
        this.postMessage =  (message: any) => { postMessage(message) };
        this.name = name

        try {
            
            if (messageBus.addEventListener) {
                messageBus.addEventListener('message', (event : MessageEvent) => {
                    this.handleMessage(event.data.pluginMessage);
                });
            } else {
                messageBus.on('message', (message: any) => { this.handleMessage(message) })
            }
        } catch (e) {
            let error = new Error('was not able to add event listener to receive events' + name)
            throw error
        }
        
    }
 
    handleMessage(message: any) {
        
        if (message.target == 'AsyncFunctionProxy') {
            if (message.type === AsyncMessageBus.invocationResult) {
                this.handleInvocationResult(message);
            } else if (message.type === AsyncMessageBus.invocationRequest) {
                this.handleInvocationRequest(message);
            }
        }
    }

    /**
     * monkey patches all async method of the given instnce and proxies calls via figmas postMessage to 
     * sandbox or / the ui
     * 
     * @param instance 
     */
    proxyAsyncMethods(instance: any) {
        let instanceClassName = instance.constructor.name
        
        let instancePrototype = Object.getPrototypeOf(instance);
        for (let memberName of Object.getOwnPropertyNames(instancePrototype)) {

            if (memberName != 'constructor' &&
                instancePrototype[memberName].constructor &&
                instancePrototype[memberName].constructor.name === 'Function') {

                let proxy = this;
                instancePrototype[memberName] = async function () {
                   // console.log(proxy.name + ' request invocation of: ' + instanceClassName + '.' + memberName);
                    return proxy.invoke(instanceClassName + '.' + memberName, Array.prototype.slice.call(arguments))
                }
            }
        }
    }

    registerInstance(instance: any) {
        let instanceClassName = instance.constructor.name
        //console.log(this.name+ ' proxy class:' + instanceClassName + Object.getOwnPropertyNames(instance));

        let instancePrototype = Object.getPrototypeOf(instance);
        for (let memberName of Object.getOwnPropertyNames(instancePrototype)) {

            if (memberName != 'constructor' &&
                instancePrototype[memberName].constructor &&
                instancePrototype[memberName].constructor.name === 'Function') {
                
                //console.log(this.name+ ' proxy class!' + instanceClassName + '.' + memberName);
                this.registerInvocationHandler(instanceClassName + '.' + memberName, instance, instance[memberName])

            }
        }
    }

    private registerInvocationHandler(messageName: string, instance: any, messageHandler: Promise<any>) {
        if (this.invocationRequestHandler[messageName]) {
            throw new Error(this.name+ ' Message ' + messageName + ' handler did exist already')
        }
        this.invocationRequestHandler[messageName] = {
            instance: instance,
            method: messageHandler
        }
    }

    private async invoke(messageName: string, parameter: any | undefined) {
        let invocationId = messageName + '.' + this.invocationId++
    
        return new Promise((resolve, reject) => {
            this.invocationRequests[invocationId] = {
                messageName: messageName,
                resolve: resolve.bind(this),
                reject: reject.bind(this)
            }

            let message = {
                target: 'AsyncFunctionProxy',
                type: AsyncMessageBus.invocationRequest,
                name: messageName,
                id: invocationId,
                parameter: parameter
            };
            this.postMessage(message)

        })

    }

    handleInvocationRequest(pluginMessage: any) {
        if (!this.invocationRequestHandler[pluginMessage.name]) {
            throw new Error(this.name+ ' Invocation handler for [' + pluginMessage.name + '] does not exist (did you register the executing instance in ['+this.name +']?');
        }

        let methodHandler = this.invocationRequestHandler[pluginMessage.name];

        methodHandler.method.apply(methodHandler.instance, pluginMessage.parameter).then((data: any) => {
            let transferObj = {       
                'target': 'AsyncFunctionProxy',     
                'type': AsyncMessageBus.invocationResult,
                'invocationId': pluginMessage.id,
                'result': data            
            };
            this.postMessage(transferObj)
            
        }).catch((error: Error) => {
            console.error(error);
            this.postMessage({
                'target': 'AsyncFunctionProxy',
                'type': AsyncMessageBus.invocationResult,
                'invocationId': pluginMessage.id,
                'error': error
            })
        })
    }

    handleInvocationResult(pluginMessage: any) {
        
        if (!this.invocationRequests[pluginMessage.invocationId]) {
            throw Error(this.name+ ' Invocation with id ' + pluginMessage.invocationId + ' was not found ')
        }

        if (pluginMessage.error !== undefined) { 
            this.invocationRequests[pluginMessage.invocationId].reject(pluginMessage.error);
        } else {
            let fn = this.invocationRequests[pluginMessage.invocationId].resolve;
            // console.log(this.name, " handleInvocationResult result "+ fn + ' ' + JSON.stringify(pluginMessage))
            fn(pluginMessage.result);
        } 

        return true;
    }
}