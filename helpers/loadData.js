const Product = require("../models/Product");
const PRODUCTS = require("../data/products");
const Category = require("../models/Category");
const CATEGORIES = require("../data/categories");

const loadData = async () => {
  // Eliminamos los datos que ya estaban
  console.info("Eliminando categorías y productos");
  await Category.deleteMany({});
  await Product.deleteMany({});

  const categories = CATEGORIES.map((e) => new Category(e));
  await Category.bulkSave(categories);

  const products = PRODUCTS.map((e) => {
    const category = categories.find(
      (category) => category.name === e.category
    );

    e.category = category?._id;
    return new Product(e);
  });
  await Product.bulkSave(products);

  console.log(`Se cargaron ${categories.length} categorías exitosamente`);
  console.log(`Se cargaron ${products.length} productos exitosamente`);
};

module.exports = loadData;
