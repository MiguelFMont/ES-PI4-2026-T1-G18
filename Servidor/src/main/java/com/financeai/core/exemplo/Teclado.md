# Teclado.java — Leitura de comandos do console

## O que deve ter neste arquivo
- A classe `Teclado.java` que já vem no material do professor, **copiada sem alterações**. Ela só é usada pelo `Main` para ler o comando `desativar` digitado no console do servidor.
- Não tem relação com o protocolo nem com os grupos.

## Exemplo de uso

```java
String comando = null;
try
{
    comando = Teclado.getUmString();
}
catch (Exception erro)
{}
```
