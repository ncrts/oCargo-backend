// utils/generateUniquePseudoName.js

const Client = require("../models/client.model"); // <-- update path according to your project

const pseudoNames = [
  "eloise",
  "marceau",
  "noemie",
  "remy",
  "aline",
  "gael",
  "louna",
  "maelys",
  "clement",
  "anais",
  "julien",
  "lea",
  "mylo",
  "sacha",
  "nael",
  "serena",
  "mael",
  "lila",
  "ambre",
  "ocelie"
];

function generatePseudo() {
  const name = pseudoNames[Math.floor(Math.random() * pseudoNames.length)];
  const number = Math.floor(100000 + Math.random() * 900000); // 6 digits
  return `${name}${number}`;
}

async function generateUniquePseudoName() {
  let pseudo;
  let exists = true;

  while (exists) {
    pseudo = generatePseudo();

    // Check in DB
    exists = await Client.exists({ pseudoName: pseudo });
  }

  return pseudo;
}

module.exports = generateUniquePseudoName;
