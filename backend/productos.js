'use strict';

// Catálogo de la tienda Magochix. Cada producto indica el "tipo" de imagen (frontend/img/<tipo>.svg)
const T_LETRAS = ['S', 'M', 'L', 'XL'];
const T_PANTALON = ['28', '30', '32', '34'];
const T_UNICA = ['Única'];

const productos = [
  // ---------- ROPA ----------
  {
    id: 1, nombre: "Camiseta Oversize Mago'x", marca: "Mago'x", precio: 18000, categoria: 'ropa', tipo: 'camiseta', tallas: T_LETRAS,
    descripcion: 'La camiseta insignia de la marca, con caída holgada y mucho estilo.',
    caracteristicas: ['100% algodón orgánico peinado', 'Corte oversize moderno', 'Transpirable y de alta durabilidad']
  },
  {
    id: 2, nombre: "Hoodie Signature Mago'x", marca: "Mago'x", precio: 32000, categoria: 'ropa', tipo: 'hoodie', tallas: T_LETRAS,
    descripcion: 'Un hoodie abrigador para los días frescos, con el sello de la marca.',
    caracteristicas: ['Felpa térmica interna', 'Capucha de doble capa', 'Bolsillo canguro reforzado']
  },
  {
    id: 5, nombre: "Camiseta Básica Mago'x", marca: "Mago'x", precio: 12000, categoria: 'ropa', tipo: 'camiseta', tallas: T_LETRAS,
    descripcion: 'El básico que nunca falla, ideal para combinar con todo.',
    caracteristicas: ['Algodón suave de corte regular', 'Cuello reforzado', 'Costuras planas, sin roces']
  },
  {
    id: 6, nombre: 'Camisa Casual Lino', marca: "Mago'x", precio: 24000, categoria: 'ropa', tipo: 'camisa', tallas: T_LETRAS,
    descripcion: 'Fresca y elegante, perfecta para el clima tropical.',
    caracteristicas: ['Lino fresco y ligero', 'Manga larga enrollable', 'Botones de nácar']
  },
  {
    id: 7, nombre: 'Chaqueta Rompevientos Sport', marca: 'Adidas', precio: 38000, categoria: 'ropa', tipo: 'chaqueta', tallas: T_LETRAS,
    descripcion: 'Ligera y resistente para entrenar o para los días de lluvia.',
    caracteristicas: ['Tela repelente al agua', 'Capucha ajustable', 'Bolsillos con cierre', 'Ultraligera y empacable']
  },
  {
    id: 8, nombre: 'Polo Clásico Piqué', marca: "Mago'x", precio: 20000, categoria: 'ropa', tipo: 'polo', tallas: T_LETRAS,
    descripcion: 'Un clásico renovado para la oficina o una salida casual.',
    caracteristicas: ['Tejido piqué de algodón', 'Cuello estructurado', 'Bordado discreto en el pecho']
  },

  // ---------- PANTALONES ----------
  {
    id: 3, nombre: 'Jeans Cargo Urban', marca: 'Nike', precio: 45000, categoria: 'pantalones', tipo: 'jeans', tallas: T_PANTALON,
    descripcion: 'Jeans con espíritu utilitario y comodidad todo el día.',
    caracteristicas: ['Mezclilla stretch flexible', 'Múltiples bolsillos utilitarios', 'Ajuste ergonómico']
  },
  {
    id: 9, nombre: 'Pantalón Jogger Comfort', marca: "Mago'x", precio: 28000, categoria: 'pantalones', tipo: 'jogger', tallas: T_LETRAS,
    descripcion: 'Comodidad total para el día a día.',
    caracteristicas: ['Felpa liviana', 'Cintura elástica con cordón', 'Puños ajustados']
  },
  {
    id: 10, nombre: 'Jeans Slim Fit Clásico', marca: "Mago'x", precio: 39000, categoria: 'pantalones', tipo: 'jeans', tallas: T_PANTALON,
    descripcion: 'El jean azul oscuro que combina con todo.',
    caracteristicas: ['Mezclilla azul oscuro', 'Corte slim', 'Toque de elastano para mayor movilidad']
  },
  {
    id: 11, nombre: 'Short Deportivo Dry-Fit', marca: 'Nike', precio: 19000, categoria: 'pantalones', tipo: 'short', tallas: T_LETRAS,
    descripcion: 'Para entrenar o salir a correr sin preocuparte del calor.',
    caracteristicas: ['Tela de secado rápido', 'Forro interno', 'Bolsillo con cierre']
  },
  {
    id: 12, nombre: 'Pantalón Chino Elegante', marca: "Mago'x", precio: 35000, categoria: 'pantalones', tipo: 'chino', tallas: T_PANTALON,
    descripcion: 'Ideal para la oficina o una salida casual.',
    caracteristicas: ['Gabardina suave', 'Corte recto', 'Cierre y botón metálico']
  },
  {
    id: 13, nombre: 'Bermuda Cargo Outdoor', marca: "Mago'x", precio: 26000, categoria: 'pantalones', tipo: 'bermuda', tallas: T_PANTALON,
    descripcion: 'Pensada para la aventura y los fines de semana.',
    caracteristicas: ['Seis bolsillos funcionales', 'Tela resistente', 'Cinturón integrado']
  },

  // ---------- ACCESORIOS ----------
  {
    id: 4, nombre: "Gorra Snapback Mago'x", marca: "Mago'x", precio: 12000, categoria: 'accesorios', tipo: 'gorra', tallas: T_UNICA,
    descripcion: 'La gorra con el logo de la marca bordado al frente.',
    caracteristicas: ['Diseño estructurado', 'Broche ajustable', 'Bordado frontal en 3D de alta definición']
  },
  {
    id: 14, nombre: 'Mochila Urbana 20L', marca: "Mago'x", precio: 29000, categoria: 'accesorios', tipo: 'mochila', tallas: T_UNICA,
    descripcion: 'Para la universidad, el trabajo o la aventura.',
    caracteristicas: ['Compartimento para laptop de 15 pulgadas', 'Tela impermeable', 'Correas acolchadas ergonómicas']
  },
  {
    id: 15, nombre: 'Cinturón de Cuero Genuino', marca: "Mago'x", precio: 15000, categoria: 'accesorios', tipo: 'cinturon', tallas: ['S (85 cm)', 'M (95 cm)', 'L (105 cm)'],
    descripcion: 'Un cinturón resistente y de acabado elegante.',
    caracteristicas: ['Cuero genuino', 'Hebilla metálica pulida', 'Duradero y flexible']
  },
  {
    id: 16, nombre: 'Gorro Beanie Invierno', marca: "Mago'x", precio: 9000, categoria: 'accesorios', tipo: 'gorro', tallas: T_UNICA,
    descripcion: 'Abrigo y estilo para los días fríos.',
    caracteristicas: ['Tejido acanalado suave', 'Forro interno', 'Parche bordado de la marca']
  },
  {
    id: 17, nombre: 'Lentes de Sol Polarizados', marca: "Mago'x", precio: 22000, categoria: 'accesorios', tipo: 'lentes', tallas: T_UNICA,
    descripcion: 'Protege tus ojos con mucho estilo.',
    caracteristicas: ['Lentes polarizados', 'Protección UV400', 'Marco liviano resistente a impactos']
  },
  {
    id: 18, nombre: 'Medias Deportivas Pack x3', marca: 'Nike', precio: 11000, categoria: 'accesorios', tipo: 'medias', tallas: ['S/M', 'L/XL'],
    descripcion: 'Tres pares para entrenar con comodidad.',
    caracteristicas: ['Pack de 3 pares', 'Refuerzo en talón y puntera', 'Soporte en el arco del pie']
  }
].sort((a, b) => a.id - b.id);

const porId = new Map(productos.map(p => [p.id, p]));

module.exports = { productos, porId };
