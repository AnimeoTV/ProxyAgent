declare module "apis" {
    import { default as DDiscord }  from "discord.js";
    import { IncomingMessage }      from "http";

    interface FetchResult extends IncomingMessage {
        json()          : Promise<any>;
        text()          : Promise<string>;
        raw()           : Promise<Buffer>;
    }

    type DiscordOAuth2Session = {
        access_token    : string;
        refresh_token   : string;
        scope           : string;
        expires_in      : number;
    };

    type DiscordConstructorOptions = {
        client_id       : string;
        client_secret   : string;
        redirect_uri    : string;
        scope           : string;
        response_type   : string;
    };

    class Discord {
        public authorize_url: string;

        constructor(options: DiscordConstructorOptions);
        authorize(code: string): Promise<DiscordOAuth2Session>;
        refreshToken(refreshToken: string): Promise<DiscordOAuth2Session>;

        static getUser(token: string): Promise<DDiscord.APIUser>;
        static getGuilds(token: string): Promise<DDiscord.RESTAPIPartialCurrentUserGuild[]>;
    }

    function fetch(method: string, url: string, options?: object): Promise<FetchResult>;
    function sleep(milliseconds: number): Promise<void>;
    function querystring(obj: object): string;
    function randomString(length: number, encoding?: BufferEncoding): string;
    function atob(str: string): string;
    function btoa(str: Buffer): string;
}
