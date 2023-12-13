const express = require('express')
const { Order, Product, sequelize } = require('./schema')
const bodyParser = require('body-parser')
const { RabbitMqConnection } = require('./RabbitMqConnection')

const app = express()
const port = 8000

app.use(express.json())
app.use(bodyParser())


app.post('/api/create-product', async (req, res) => {
    const productData = req.body
    try {
        const product = await Product.create(productData)
        res.json(product)
    } catch (error) {
        res.json({
            message: 'something wront',
            error
        })
    }
})

app.post('/api/insert-order', async (req, res) => {
    try {
        const { productId, userId } = req.body

        RabbitMqConnection.sendMessage(req.body, 'orders-new')
        console.log(" [x] Sent %s", req.body)
        res.json({
            message: `buy successful. waiting message for confirm.`
        })
    } catch (error) {
        console.log(error);
        res.json({
            message: 'something wront',
            error
        })
    }
})


const startApp = async () => {
    await sequelize.sync()
    RabbitMqConnection.getInstance()
    app.listen(port, () => {
        console.log(`Server is running on http://localhost:${port}`);
    });
}


startApp()