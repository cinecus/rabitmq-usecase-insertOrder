const amqp = require('amqplib')

class RabbitMqConnection {
    constructor(queue = 'orders-new') {
        RabbitMqConnection.createConnection(queue)
        this.connection = null
        this.channel = null
        this.queue = queue
    }

    static getInstance(queue = 'orders-new') {
        if (!RabbitMqConnection.instance) {
            RabbitMqConnection.instance = new RabbitMqConnection(queue)
        }
        return RabbitMqConnection.instance
    }

    static async createConnection(queue) {
        try {

            this.connection = await amqp.connect('amqp://cinecus:123456@localhost:5672')
            this.channel = await this.connection.createChannel()
            await this.channel.assertQueue(queue)
            console.log('Rabbit connection established')
        } catch (error) {
            console.log('Rabbit connection fail')
            console.log(error)
        }
    }

    static async sendMessage(message, queueName) {
        try {
            let msg = this.channel.sendToQueue(queueName, Buffer.from(JSON.stringify(message)), { persistent: true })
            return msg
        } catch (error) {
            console.log(error)
        }
    }
}

module.exports = { RabbitMqConnection }