/**
 * DTO que representa o payload de um token JWT.
 * Contém as informações (claims) incluídas no token.
 */
export class JwtPayloadDto {
    /**
     * Subject - Identificador único do usuário
     */
    sub: string;

    /**
     * Issuer - Emissor do token
     */
    iss: string;

    /**
     * Email do usuário
     */
    email: string;

    /**
     * Lista de papéis (roles) atribuídos ao usuário
     */
    roles: string[];

    /**
     * Peso máximo de conteúdo sensível permitido para o usuário
     */
    maxWeightSensitiveContent: number;

    /**
     * Timestamp de criação do token (opcional)
     */
    iat?: number;

    /**
     * Timestamp de expiração do token (opcional)
     */
    exp?: number;

    /**
     * Identificador da sessão (opcional)
     */
    sessionId?: string;

    /**
     * Endereço IP do usuário (opcional)
     */
    ipAddress?: string;

    /**
     * User agent do cliente (opcional)
     */
    userAgent?: string;

    /**
     * Permissões específicas (opcional)
     */
    permissions?: string[];

    /**
     * Dados customizados adicionais (opcional)
     */
    customClaims?: Record<string, any>;
}
