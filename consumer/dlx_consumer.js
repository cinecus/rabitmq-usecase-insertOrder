const { Order, Product, sequelize } = require('./schema')
const amqp = require('amqplib')
const { v4: uuidv4 } = require('uuid')

const delay = async (t) => new Promise((resolve) => setTimeout(resolve, t))

async function receiveDeadLetterOrders() {

    const connection = await amqp.connect('amqp://cinecus:123456@localhost:5672')
    const channel = await connection.createChannel()

    const queueError = 'orders-error'
    await channel.assertQueue(queueError, { durable: true })

    const queueNoti = 'noti'
    await channel.assertQueue(queueNoti, { durable: true })

    console.log(' [*] Waiting for Dead Letter in %s. To exit press CTRL+C', queueError)
    // ทำทีละกี่ตัว 
    channel.prefetch(1)

    channel.consume(queueError, async (msg) => {
        try {

            const { productId, userId } = JSON.parse(msg.content.toString())
            console.log(" [x] Received Dead Letter %s", msg.content.toString())

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
                channel.nack(msg, false, false)
                console.log('product out of stock na');
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
            channel.nack(msg, false, true) //ไม่ปล่อย queue ทำซ้ำอีกรอบจนกว่าจะสำเร็จ
            console.log('Error:', error.message)
        }
    })


}


const startApp = async () => {
    try {
        await sequelize.sync()

        await receiveDeadLetterOrders()

    } catch (error) {
        console.log(error);
    }
}

startApp()
