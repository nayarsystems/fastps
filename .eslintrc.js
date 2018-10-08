module.exports = {
  extends: ["airbnb-base", "prettier", "plugin:prettier/recommended"],
  plugins: ["jest", "prettier"],
  env: {
    "jest/globals": true
  },
  rules: {
    "no-underscore-dangle": "off",
    "prettier/prettier": "error"
  }
};
