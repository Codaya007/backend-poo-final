// Requiero los modelos que necesitaré
const Order = require("../models/Order");
const Product = require('../models/Product');
// requiero mi middleware de autenticación
const { auth, adminAuth } = require('../middleware');
// express-validator para validar las peticiones
const { check, validationResult } = require('express-validator');
const { PENDING, COMPLETED } = require("../helpers/constants");
const ObjectID = require("mongodb").ObjectId


const orderRouter = require("express").Router();


// @route POST api/order
// @desc Create a Order 
// access Private
orderRouter.post("/", [
   check('country', 'El campo Country es requerido').trim().not().isEmpty(),
   check('city', 'El campo City es requerido').trim().not().isEmpty(),
   check('address', 'El campo Address es requerido').trim().not().isEmpty(),
   check('reference', 'El campo Reference es requerido').trim().not().isEmpty(),
   check('products', 'El campo Products es requerido').isArray({ min: 1 }).exists(),
   check('products', 'Cada Producto en el campo Products requiere un atributo "productId" y "quantity": [{ productId, quantity }]')
      .custom(products => {
         let err = products.filter(e => {
            if (!e.productId || !e.quantity) return e;
         });

         return !err.length;
      })
], auth, async (req, res, next) => {

   if (req.error) return next();

   const errors = validationResult(req);

   if (!errors.isEmpty()) {
      req.error = { status: 400, errors };
      return next();
   }

   // El id lo sacamos del token
   const { country, city, address, reference, products } = req.body;
   // products: [{ productId, quantity }]
   try {
      let totalAmount = 0;
      let productsExist = await Promise.all(products.map(async (e) => {
         // Valido que se me haya proporcionado un id válido
         if (!ObjectID.isValid(e.productId)) return null;

         let product = await Product.findOne({ id: e.productId });
         if (product) {
            product = product.toJSON();
            // console.log(product);
            if (e.quantity === 0) return null;
            e.quantity = e.quantity <= product.quantity ? e.quantity : product.quantity;
            totalAmount += (e.quantity * product.price);
            return { ...e };
         }
         return null;
      }));

      //quito los productos que no existen
      productsExist = productsExist.filter(e => e);
      // console.log(productsExist);
      // console.log(totalAmount);

      let newOrder = new Order({ userId: req.user.id, country, city, address, reference, products: productsExist, totalAmount });
      await newOrder.save();
      res.json(newOrder);
   } catch (err) {
      console.log(err);
      req.error = {};
      next();
   }
});


// @route PUT api/order/:id
// @desc Edit an Order
// access Private Admin
orderRouter.put("/:id", [
   check('status', `El campo Status sólo puede tomar los valores: ${PENDING} o ${COMPLETED}`).trim().optional().custom(e => {
      return [PENDING, COMPLETED].includes(e);
   }),
], auth, adminAuth, async (req, res, next) => {

   if (req.error) return next();

   const errors = validationResult(req);

   if (!errors.isEmpty()) {
      req.error = { status: 400, errors };
      return next();
   }

   // Elimino los campos que no se podrían modificar:
   delete req.body._id
   delete req.body.updatedAt
   delete req.body.createdAt
   // console.log(req.body);

   try {
      const updatedOrder = await Order.findByIdAndUpdate(
         req.params.id,
         {
            $set: req.body,
         },
         { new: true }
      );
      res.status(200).json(updatedOrder);
   } catch (err) {
      console.log(err);
      req.error = {};
      next();
   }
});


// @route DELETE api/order/:orderId
// @desc Delete an Order
// access Private
orderRouter.delete("/:orderId", auth, async (req, res, next) => {

   if (req.error) return next();

   try {
      await Order.findByIdAndDelete(req.params.orderId);
      res.status(200).json("Order has been deleted...");
   } catch (err) {
      console.log(err);
      req.error = {};
      next();
   }
});


// @route GET api/order/user
// @desc Get all orders of an user
// access Private
orderRouter.get("/user", auth, async (req, res, next) => {

   if (req.error) return next();

   try {
      const orders = await Order.find({ userId: req.user.id });
      res.status(200).json(orders);
   } catch (err) {
      console.log(err);
      req.error = {};
      next();
   }
});


// @route GET api/order
// @desc Get all orders
// access Private Admin
orderRouter.get("/", auth, adminAuth, async (req, res, next) => {

   if (req.error) return next();

   try {
      const orders = await Order.find({});
      res.status(200).json(orders);
   } catch (err) {
      console.log(err);
      req.error = {};
      next();
   }
});


// @route GET api/order/income
// @desc GET MONTHLY INCOME
// access Private Admin
orderRouter.get("/income", auth, adminAuth, async (req, res, next) => {

   if (req.error) return next();

   const date = new Date();
   const lastMonth = new Date(date.setMonth(date.getMonth() - 1));
   const previousMonth = new Date(new Date().setMonth(lastMonth.getMonth() - 1));

   try {
      const income = await Order.aggregate([
         {
            $match:
               { createdAt: { $gte: previousMonth } }
         },
         {
            $project: {
               month: { $month: "$createdAt" },
               sales: "$totalAmount",
            },
         },
         {
            $group: {
               _id: "$month",
               total: { $sum: "$sales" },
            },
         },
      ]);
      res.status(200).json(income);
   } catch (err) {
      console.log(err);
      req.error = {};
      next();
   }
});


// @route GET api/order/:orderId
// @desc Get order detail
// access Private
orderRouter.get("/:orderId", auth, async (req, res, next) => {

   const { orderId } = req.params;

   if (req.error) return next();

   if (!ObjectID.isValid(orderId)) {
      req.error = { status: 400, message: "Id no válido" };
      return next();
   };

   try {
      let order = await Order.findById(orderId);

      if (!order) {
         req.error = { status: 404, message: "Pedido no encontrado" };
         return next();
      }

      let productos = await Promise.all(order.products.map(async (prod) => {
         let finded = await Product.findById(prod.productId)
            .select('name price')
         finded = finded && finded.toJSON();

         return finded ? { ...finded, quantity: prod.quantity } : null;
      }));
      order = order.toJSON();

      productos = productos.filter(e => e);

      res.status(200).json({ ...order, products: productos });
   } catch (err) {
      console.log(err);
      req.error = {};
      next();
   }
});


module.exports = orderRouter;
