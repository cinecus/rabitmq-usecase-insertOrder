const { Order, Product, sequelize } = require('./schema')
const amqp = require('amqplib')
const { v4: uuidv4 } = require('uuid')


async function receiveOrders() {

    const connection = await amqp.connect('amqp://cinecus:123456@localhost:5672')
    const channel = await connection.createChannel()

    const queue = 'orders-new'
    await channel.assertQueue(queue, { durable: true })

    const queueError = 'orders-error'
    await channel.assertQueue(queueError, { durable: true })

    const queueNoti = 'noti'
    await channel.assertQueue(queueNoti, { durable: true })

    console.log(' [*] Waiting for messages in %s. To exit press CTRL+C', queue)

    // ทำทีละกี่ตัว 
    channel.prefetch(1)

    channel.consume(queue, async (msg) => {
        try {

            const { productId, userId } = JSON.parse(msg.content.toString())
            console.log(" [x] Received %s", msg.content.toString())

            // จำลอง 1 ใน 10 ของ Order ที่เข้ามาจะเกิด Error บ้าง
            const randomNumber = Math.floor((Math.random() * 10) + 1);
            console.log('random number is ', randomNumber);
            if (randomNumber > 9) {
                throw new Error('error na')
            }

            const product = await Product.findOne({
                where: {
                    id: productId
                }
            })

            if (product.amount <= 0) {
                //กรณีของหมด ส่งให้ Queue ที่ทำเรื่อง Noti ไปทำต่อ รอ consumer ที่ส่ง noti มารับงาน
                channel.sendToQueue(queueNoti, msg.content, { persistent: true })
                console.log('product out of stock na')
                channel.nack(msg, false, false)
                return
            }

            // reduce amount
            product.amount -= 1
            await product.save()

            // create order with status pending
            const order = await Order.create({
                productId: product.id,
                orderId: uuidv4(),
                userLineUid: userId,
                status: 'pending'
            })

            console.log("Order saved to database with id:", order.orderId)

            // บอกว่าได้ message แล้ว
            channel.ack(msg)
        } catch (error) {
            // บอกว่าไม่สนใจ message
            channel.nack(msg, false, false)
            //ส่งให้ Queue ที่จัดการ Error ไปวนทำซ้ำ
            channel.sendToQueue(queueError, msg.content, { persistent: true })
            console.log('Error:', error.message)
        }
    })


}


const startApp = async () => {
    try {
        await sequelize.sync()
        await receiveOrders()

    } catch (error) {
        console.log(error);
    }
}

startApp()
