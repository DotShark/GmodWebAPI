const readline = require("readline");
const { GmodMap } = require("./utils/gmodMap");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function askQuestion(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
    console.log("Entrez le nom de la map :");
    const mapName = (await askQuestion("")).trim();
    const mapInstance = new GmodMap(mapName);
    await mapInstance.download();
    await mapInstance.extractBz2();

    console.log("Voulez-vous mettre en ligne la map sur un serveur de jeu ? (oui / non)");
    const gameServerAnswer = (await askQuestion("")).trim();
    if (gameServerAnswer === "oui") {
        console.log("Entrez le nom du serveur :");
        const sftpSession = (await askQuestion("")).trim();
        await mapInstance.uploadFile("bsp", sftpSession);
    }

    console.log("Voulez-vous mettre en ligne la map sur un miroir FastDL ? (oui / non)");
    const fastdlAnswer = (await askQuestion("")).trim();
    if (fastdlAnswer === "oui") {
        console.log("Entrez le nom du serveur :");
        const sftpSession = (await askQuestion("")).trim();
        await mapInstance.uploadFile("bz2", sftpSession);
    }

    console.log("Voulez-vous supprimer les fichiers que vous avez téléchargé ?");
    const deleteAnswer = (await askQuestion("")).trim();
    if (deleteAnswer === "oui") {
        await mapInstance.deleteFile("bsp");
        await mapInstance.deleteFile("bz2");
    }

    await askQuestion("Appuyez sur une touche pour continuer...");
    rl.close();
}

main().catch(err => {
    console.error(err);
    rl.close();
});
