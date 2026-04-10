const fs = require("fs").promises;
const { createWriteStream } = require("fs");
const axios = require("axios");
const path = require("path");
const Client = require("ssh2-sftp-client");
const { cwd } = require("process");
const { exec } = require("child_process");

class GmodMap {
    constructor(name) {
        this.name = name;
        this.url = `https://main.fastdl.me/maps/${name}.bsp.bz2`;
        this.mapsFolder = "/var/www/fastdl/maps";
        this.bz2FilePath = path.join(this.mapsFolder, `${name}.bsp.bz2`);
        this.bspFilePath = path.join(this.mapsFolder, `${name}.bsp`);

        this.createMapsFolder();
    }

    async createMapsFolder() {
        try {
            await fs.mkdir(this.mapsFolder, { recursive: true });
        } catch (error) {
            console.error(error.message);
        }
    }

    async download() {
        const response = await axios.get(this.url, { responseType: "stream" });
        const writer = createWriteStream(this.bz2FilePath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", reject);
        });
    }

    async extractBz2() {
        const command = `bzip2 -d -k ${this.bz2FilePath}`;
        return new Promise((resolve, reject) => {
            exec(command, (error, stdout) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(stdout);
                }
            });
        });
    }

    async deleteFile(fileType) {
        let filePath;
        if (fileType === "bz2") {
            filePath = this.bz2FilePath;
        } else if (fileType === "bsp") {
            filePath = this.bspFilePath;
        } else {
            return;
        }

        try {
            await fs.unlink(filePath);
        } catch (error) {
            console.error(`Failed to delete file: ${error.message}`);
        }
    }

    async uploadFile(fileType, sftpSession) {
        try {
            const fileContent = await fs.readFile(path.join(cwd(), "sftps.json"), "utf8");
            const session = JSON.parse(fileContent)[sftpSession];
            if (!session) {
                return;
            }

            const filePath = fileType === "bz2" ? this.bz2FilePath : this.bspFilePath;
            try {
                await fs.access(filePath);
            } catch {
                return;
            }

            const sftp = new Client();
            try {
                await sftp.connect({
                    host: session.host,
                    port: session.port,
                    username: session.user,
                    password: session.password
                });

                const remotePath = path.join(session.mapsPath, path.basename(filePath));
                await sftp.put(filePath, remotePath);
            } catch (err) {
            } finally {
                sftp.end();
            }
        } catch (error) {
            console.error(`Something went wrong while trying to upload the file: ${error.message}`);
        }
    }
}

module.exports = { GmodMap };