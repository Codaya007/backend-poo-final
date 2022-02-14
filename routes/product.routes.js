const { Router } = require('express');
const Product = require('../models/Product');
const { auth, adminAuth, productById } = require('../middleware');
const formidable = require('formidable');
const fs = require('fs');
const mongoose = require('mongoose');


const productRouter = Router();

// @route POST api/product
// @desc Create a Product 
// access Private Admin
productRouter.post('/', auth, adminAuth, async (req, res, next) => {

   if (req.error) return next();

   // Para mantener la extensión del archivo original y limitarlo a 1mb
   let form = new formidable.IncomingForm({ keepExtensions: true, maxFieldsSize: 1024 * 1024 });

   form.parse(req, async (err, fields, files) => {
      if (err) {
         req.error = {
            status: 400,
            message: 'Image could not be uploaded'
         };
         return next()
      };

      if (!files.photo) {
         req.error = {
            status: 400,
            message: 'Image is required'
         };
         return next()
      };

      // Valido la extensión del archivo. Valores permitidos: jpeg, png, jpg
      if (files.photo.mimetype !== 'image/jpeg' && files.photo.mimetype !== 'image/jpg' && files.photo.mimetype !== 'image/png') {
         req.error = {
            status: 400,
            message: 'Image type not allowed'
         };
         return next();
      }

      // cheking all fields
      const { name, description, price, category, quantity, shipping } = fields;


      if (!name || !description || !price || !category || !quantity) {
         req.error = {
            status: 400,
            message: 'All fields are required'
         }
         return next();
      }

      let product;
      try {
         product = await Product.findOne({ name });

         if (product) {
            req.error = {
               status: 400,
               message: 'Product already exists'
            }
            return next()
         };
      } catch (err) {
         console.log(err);
         req.error = {};
         return next();
      }

      product = new Product(fields);

      // 1MB = 1048576
      if (files.photo.size > 1048576) {
         req.error = {
            status: 400,
            message: 'Image should be less than 1MB in size'
         };
         return next();
      }

      product.photo.data = fs.readFileSync(files.photo.filepath);
      product.photo.contentType = files.photo.mimetype;

      try {
         await product.save()
         res.status(201).json('Product Created Successfully');

      } catch (err) {
         console.log(err);
         req.error = {};
         next();
      }
   })
});


// @route GET api/product/all
// @desc Get all products
// @access Public
productRouter.get('/all', async (req, res, next) => {

   try {
      let data = await Product.find({})
         .select('-photo').populate('category')

      res.json(data);
   } catch (err) {
      console.log(err);

      req.error = {};
      next();
   }
})


// @route GET api/product/list
// @desc Get a list of products with filter
// @options(order = asc or desc, sortBy any product property like name, limit, number of returned product)
// @access Public
productRouter.get('/list', async (req, res, next) => {
   let { order = "asc", sortBy = "_id", limit } = req.query;
   limit = parseInt(limit);
   // let order = req.query.order ? req.query.order : 'asc';
   // let sortBy = req.query.sortBy ? req.query.sortBy : '_id';
   // let limit = parseInt(req.query.limit) : 10;

   try {
      let products = await Product.find({})
         .select('-photo').populate('category').sort([
            [sortBy, order]
         ]).limit(limit || 15).exec();

      res.json(products);

   } catch (err) {
      console.log(err);

      req.error = { status: 400, message: 'Invalid querys' };
      next();
   }

})


// @route GET api/product/categories
// @desc Get a list categories of products
// @access Public
productRouter.get('/categories', async (req, res, next) => {
   try {
      let categories = await Product.distinct('category');

      if (!categories) {
         req.error = {
            status: 404,
            message: 'Categories not found'
         };
         return next();
      }

      res.json(categories);
   } catch (err) {
      console.log(err);
      req.error = {};
      next();
   }
});


// @route GET api/product/search
// @desc Get a list products by search and category query
// @access Public
productRouter.get('/search', async (req, res, next) => {
   let { search, category } = req.query;
   const query = {};

   if (search) {
      query.name = {
         $regex: search,
         $options: 'i'
      }

      // assign category
      if (category) {
         if (!mongoose.Types.ObjectId.isValid(category) && category !== 'all') {
            req.error = {
               status: 404,
               message: 'Category not found'
            };
            return next();
         }

         category !== 'all' && (query.category = category);
      }
   }

   try {
      let products = await Product.find(query).select('-photo');
      res.json(products);
   } catch (err) {
      console.log(err);
      req.error = {
         status: 500,
         message: 'Invalid querys'
      };
      next();
   }
});


// @route   GET api/product/filter
// @desc    filter a Product by price and others
// @access  Public
productRouter.get('/filter', async (req, res, next) => {
   let { order = "desc", sortBy = "_id", limit, skip, filters } = req.body;
   limit = parseInt(limit) || 100;
   // Paginado i guess
   skip = parseInt(skip);

   let findArgs = {};

   // Generamos el objeto con los filtros
   for (let key in filters) {
      if (filters[key].length > 0) {
         if (key === 'price') {
            findArgs[key] = {
               // gte -  greater than price 
               // Exmape: [0,10]
               $gte: req.body.filters[key][0],
               // lte - less than
               $lte: req.body.filters[key][1]
            };
         } else {
            findArgs[key] = req.body.filters[key];
         }
      }
   }

   try {
      let products = await Product.find(findArgs)
         .select('-photo')
         .populate('category')
         .sort([
            [sortBy, order]
         ])
         .skip(skip)
         .limit(limit);

      res.json(products);
   } catch (error) {
      console.log(error);

      req.error = {
         status: 500,
         message: 'Products not found'
      };
      next();
   }
});


// @route   GET api/product/related/:id
// @desc    get related products
// @access  Public
productRouter.get('/related/:id', productById, async (req, res, next) => {

   if (req.error) return next();

   let limit = req.query.limit ? parseInt(req.query.limit) : 6;
   let sortBy = req.query.sortBy ? req.query.sortBy : 'createdAt';
   let order = req.query.order ? req.query.order : 'desc';

   try {
      let products = await Product.find({
         _id: {
            $ne: req.product
         },
         category: req.product.category
      }).select('-photo')
         .limit(limit)
         .sort([
            [sortBy, order]
         ])
         .populate('category', '_id name')

      res.json(products);

   } catch (error) {
      console.log(error);

      req.error = {
         status: 500,
         message: 'Invalid querys'
      };
      next()
   }

})


// @route GET api/product/:id
// @desc Get a Product information
// @access Public
productRouter.get('/:id', productById, (req, res, next) => {

   if (req.error) return next();

   req.product.photo = undefined;
   return res.json(req.product);
})


// @route GET api/product/photo/:id
// @desc Get a Product Image
// @access Public
productRouter.get('/photo/:id', productById, (req, res) => {

   if (req.error) return next();

   if (req.product.photo.data) {
      res.set('Content-Type', req.product.photo.contentType);
      return res.send(req.product.photo.data);
   }
   req.error = {
      status: 400,
      message: 'failed to load image'
   };
   next();
})


// @route   DELETE api/product/:id
// @desc    Delete a Product
// @access  Private Admin
productRouter.delete('/:id', auth, adminAuth, productById, async (req, res, next) => {

   if (req.error) return next();

   let product = req.product;
   try {
      let deletedProduct = await product.remove();
      res.json({
         message: `${deletedProduct.name} deleted successfully`,
      });
   } catch (error) {
      console.log(error);

      req.error = {};
      next();
   }
});


// @route   PUT api/product/:productId
// @desc    Update Image Single product
// @access  Private Admin
productRouter.put('/photo/:id', auth, adminAuth, productById, (req, res, next) => {

   if (req.error) return next();

   let form = new formidable.IncomingForm({ keepExtensions: true });

   form.parse(req, async (err, fields, files) => {
      if (err) {
         req = {
            status: 400,
            message: 'Image could not be uploaded'
         };
         return next();
      }

      let product = req.product;
      product = _.extend(product, fields);

      if (files.photo) {
         if (files.photo.size > 1000000) {
            req.error = {
               status: 400,
               message: 'Image should be less than 1MB in size'
            }
            return next();
         }
         product.photo.data = fs.readFileSync(files.photo.path);
         product.photo.contentType = files.photo.type;
      }

      try {
         let productDetails = await product.save();
         productDetails.photo = undefined;
         res.json(productDetails);
      } catch (error) {
         console.log(error);

         req.error = {};
         next();
      }
   });
});

module.exports = productRouter;
