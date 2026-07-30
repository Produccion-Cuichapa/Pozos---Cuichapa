'use strict';

const registry = new Map();

function cleanText(value) {
  return String(value == null ? '' : value).trim();
}

function normalizeDeclaration(tool) {
  const source =
    tool.declaration &&
    typeof tool.declaration === 'object'
      ? tool.declaration
      : {};

  const name = cleanText(
    source.name || tool.name
  );

  const description = cleanText(
    source.description || tool.description
  );

  const parameters =
    source.parameters &&
    typeof source.parameters === 'object'
      ? source.parameters
      : tool.parameters &&
        typeof tool.parameters === 'object'
        ? tool.parameters
        : null;

  return {
    name: name,
    description: description,
    parameters: parameters
  };
}

function validateTool(tool) {
  if (!tool || typeof tool !== 'object') {
    throw new TypeError(
      'La herramienta debe ser un objeto.'
    );
  }

  const declaration =
    normalizeDeclaration(tool);

  if (!declaration.name) {
    throw new TypeError(
      'La herramienta necesita un nombre.'
    );
  }

  if (!declaration.description) {
    throw new TypeError(
      'La herramienta ' +
      declaration.name +
      ' necesita descripción.'
    );
  }

  if (
    !declaration.parameters ||
    typeof declaration.parameters !== 'object'
  ) {
    throw new TypeError(
      'La herramienta ' +
      declaration.name +
      ' necesita parámetros.'
    );
  }

  if (typeof tool.execute !== 'function') {
    throw new TypeError(
      'La herramienta ' +
      declaration.name +
      ' necesita execute().'
    );
  }

  return Object.assign(
    {},
    tool,
    {
      name: declaration.name,
      description: declaration.description,
      parameters: declaration.parameters,
      declaration: declaration
    }
  );
}

function register(tool) {
  const validated = validateTool(tool);

  if (registry.has(validated.name)) {
    throw new Error(
      'La herramienta ' +
      validated.name +
      ' ya está registrada.'
    );
  }

  registry.set(
    validated.name,
    validated
  );

  return validated;
}

function get(name) {
  return registry.get(name) || null;
}

function list() {
  return Array.from(
    registry.values()
  );
}

function getDeclarations() {
  return list().map(function(tool) {
    return {
      name: tool.declaration.name,
      description:
        tool.declaration.description,
      parameters:
        tool.declaration.parameters
    };
  });
}

function clear() {
  registry.clear();
}

module.exports = {
  normalizeDeclaration,
  validateTool,
  register,
  get,
  list,
  getDeclarations,
  clear
};
