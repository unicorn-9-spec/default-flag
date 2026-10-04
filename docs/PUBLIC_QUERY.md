# Public GROQ query (no token)

First five planets and their default papers. Paste into a browser:

https://0eu544dk.api.sanity.io/v2026-10-03/data/query/production?query=*%5B_type%3D%3D%22planet%22%5D%5B0...5%5D%7Bname%2C%22default%22%3AdefaultParameterSet-%3Epublication-%3Ecitation%7D

Query: `*[_type=="planet"][0...5]{name,"default":defaultParameterSet->publication->citation}`
