'use strict';

class ProviderInterface {

  constructor(name) {
    this.name = String(name || 'provider');
  }

  async generate() {
    throw new Error(
      'El proveedor "' +
      this.name +
      '" debe implementar generate().'
    );
  }

}

function validateProvider(provider) {

  if (!provider) {
    throw new Error('Proveedor no definido.');
  }

  if (typeof provider.generate !== 'function') {
    throw new Error(
      'El proveedor debe implementar generate().'
    );
  }

  return provider;
}

module.exports = {
  ProviderInterface,
  validateProvider
};
