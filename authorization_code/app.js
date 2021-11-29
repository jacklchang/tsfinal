/**
 * This is an example of a basic node.js script that performs
 * the Authorization Code oAuth2 flow to authenticate against
 * the Spotify Accounts.
 *
 * For more information, read
 * https://developer.spotify.com/web-api/authorization-guide/#authorization_code_flow
 */

var express = require('express'); // Express web server framework
var request = require('request'); // "Request" library
var cors = require('cors');
var querystring = require('querystring');
var cookieParser = require('cookie-parser');
var token = "";

var client_id = '97a10d090d554476bbbad69668b5e097'; // Your client id
var client_secret = '13bc4948fd6d4de882a6c68293c2f760'; // Your secret
var redirect_uri = 'http://localhost:8888/callback'; // Your redirect uri
const SpotifyWebApi = require('spotify-web-api-node');
const spotifyApi = new SpotifyWebApi();
//spotifyApi.setAccessToken(window.ACCESS_TOKEN);
let tracks = [];
let trackdata = {};
let tracktitles=[];

const songids = require('./songsidref.json');

/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
var generateRandomString = function (length) {
  var text = '';
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

var stateKey = 'spotify_auth_state';

var app = express();

app.use(express.static(__dirname + '/public'))
  .use(cors())
  .use(cookieParser());

app.get('/login', function (req, res) {

  var state = generateRandomString(16);
  res.cookie(stateKey, state);

  // your application requests authorization
  var scope = 'user-read-private user-read-email playlist-modify-private playlist-read-collaborative playlist-read-private playlist-modify-public';
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: client_id,
      scope: scope,
      redirect_uri: redirect_uri,
      state: state
    }));
});

app.get('/updatedplaylists', function (req, res) {
  console.log("updatedplaylists got called");
  //GET MY PROFILE DATA
  function getMyData() {
    (async () => {
      const me = await spotifyApi.getMe();
      // console.log(me.body);
      getUserPlaylists(me.body.id);
    })().catch(e => {
      console.error(e);
    });
  }

  //GET MY PLAYLISTS
  async function getUserPlaylists(userName) {
    const data = await spotifyApi.getUserPlaylists(userName)
    console.log(userName);
    console.log("---------------+++++++++++++++++++++++++")
    //var place = document.getElementById('playlists');
    //let playlists = []
    console.log("this might be a list of playlists");
    console.log(data.body.items);
    for (let playlist of data.body.items) {
      // onsole.log(playlist.name + " " + playlist.id);
      //place.innerHTML = playlist.name + " " + playlist.id;
      let tracks = await getPlaylistTracks(playlist.id, playlist.name);
      // console.log(tracks);

      const tracksJSON = { tracks }
      trackdata = JSON.stringify(tracksJSON);
      //document.getElementById('playlists').innerHTML = data;
      //fs.writeFileSync(playlist.name+'.json', data);
      return trackdata;
    }
  }

  //GET SONGS FROM PLAYLIST
  async function getPlaylistTracks(playlistId, playlistName) {

    const data = await spotifyApi.getPlaylistTracks(playlistId, {
      offset: 1,
      limit: 100,
      fields: 'items'
    })

    //console.log('The playlist contains these tracks', data.body);
    //console.log('The playlist contains these tracks: ', data.body.items[0].track);
    //console.log("'" + playlistName + "'" + ' contains these tracks:');

    for (let track_obj of data.body.items) {
      const track = track_obj.track
      tracks.push(track);
      console.log(track.name + " : " + track.artists[0].name + " id " + track.id);
      tracktitles.push(track.name);
    }
    console.log("---------------+++++++++++++++++++++++++")
    request.post(tracks, function(error, response) {
      res.send({'playlistname': playlistName, 'tracknames':tracktitles});
      return;
    });
    res.redirect('/updatedplaylists');
  }
  getMyData();

})

app.get('/callback', function (req, res) {

  // your application requests refresh and access tokens
  // after checking the state parameter

  var code = req.query.code || null;
  var state = req.query.state || null;
  var storedState = req.cookies ? req.cookies[stateKey] : null;

  if (state === null || state !== storedState) {
    res.redirect('/#' +
      querystring.stringify({
        error: 'state_mismatch'
      }));
  } else {
    res.clearCookie(stateKey);
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code'
      },
      headers: {
        'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
      },
      json: true
    };

    request.post(authOptions, function (error, response, body) {
      if (!error && response.statusCode === 200) {

        var access_token = body.access_token,
          refresh_token = body.refresh_token;

        //setting the access token
        token = access_token;
        spotifyApi.setAccessToken(access_token)
        //console.log("does this token work" + token);
        var options = {
          url: 'https://api.spotify.com/v1/me',
          headers: { 'Authorization': 'Bearer ' + access_token },
          json: true
        };

        // use the access token to access the Spotify Web API
        request.get(options, function (error, response, body) {
          console.log(body);
        });

        // we can also pass the token to the browser to make requests from there
        res.redirect('/#' +
          querystring.stringify({
            access_token: access_token,
            refresh_token: refresh_token
          }));
      } else {
        res.redirect('/#' +
          querystring.stringify({
            error: 'invalid_token'
          }));
      }
    });
  }
});

app.get('/refresh_token', function (req, res) {

  // requesting access token from refresh token
  var refresh_token = req.query.refresh_token;
  var authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: { 'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64')) },
    form: {
      grant_type: 'refresh_token',
      refresh_token: refresh_token
    },
    json: true
  };

  request.post(authOptions, function (error, response, body) {
    if (!error && response.statusCode === 200) {
      var access_token = body.access_token;
      res.send({
        'access_token': access_token
      });
    }
  });
});

console.log('Listening on 8888');
app.listen(8888);

