class Person { 
	constructor(name, firstname) {
		this.name = name;
		this.firstname = firstname;
	}
}

class Player extends Person {
    #container;
	constructor(name, firstname, role, biography, image, birthdate) {
		super(name, firstname);
        this.biography = biography;
        this.image = image;
        this.role = role;
        this.birthdate = birthdate;
        this.#container = document.createElement("div");
        this.#container.className = "card";
        document.body.appendChild(this.#container);
	};
        add(){
            const portrait = this.image
            /*On fait une vérification pour s'assurer que l'image est bien chargée*/
                ? `<img class="portrait" src="${this.image}" alt="${this.name} ${this.firstname}">`
                : `<span class="card-front-placeholder">?</span>`;
            this.#container.innerHTML = `
            <div class="content">
                <div class="front">${portrait}</div>
                <div class="back">
                    <h2>${this.name} ${this.firstname}</h2>
                    <p class="role">${this.role}</p>
                    <p class="birthdate">${this.birthdate}</p>
                    <p class="bio">${this.biography}</p>
                </div>
            </div>
            `;
        }
        remove(){
            this.#container.remove();
        }
};

const url = 'Donnees.json';
// Fonction asynchrone pour charger le JSON
async function loadJSON(url) {
  const response = await fetch(url);
  const data = await response.json();
  return data; // Renvoie les données JSON
}
// Appel de la fonction pour charger le JSON, puis “then” pour savoir quand les données sont chargées et disponibles
loadJSON(url)
    .then(data => {
       // Traitement des données JSON ici
       data.equipe.forEach(item => {
        const player = new Player(item.name, item.surname, item.role, item.biography, item.image, item.birthdate);
        player.add();
       });
    })
    .catch(error => {
        console.error('Erreur lors du chargement du JSON :', error);
    });
