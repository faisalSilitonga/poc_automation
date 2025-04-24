function convertLinkedinUrlToPublicIdentifier(linkedinUrl) {
    // get raw public identifier
    const publicIdentifierRaw = linkedinUrl.split('linkedin.com/in/').pop()

    // remove redundant text from raw public identifier (i.e. miniProfileUrl)
    return publicIdentifierRaw.split('/').shift()
}

async function getProfileActions(publicIdentifier, cookies) {
    const url = `https://www.linkedin.com/voyager/api/identity/profiles/${publicIdentifier}/profileActions`
    const headers = getVoyagerHeaders(cookies)
    const res = await makeRequest('GET', url, headers, null, true)
    return res
}

function getProfileId(entity) {
    const split = entity.split(':')
    return split.pop()
}

function getProfileIdProfileView(profileViewObj) {
    const data = JSON.parse(profileViewObj.data)
    return data.positionGroupView.profileId
}

function getTrackingId(profileViewObj) {
    const data = JSON.parse(profileViewObj.data)
    return data.profile.miniProfile.trackingId
}

function isCandidateConnected(profileActionsRes) {
    const data = profileActionsRes.data
    const disconnectAction =
        'com.linkedin.voyager.identity.profile.actions.Disconnect'
    return data.includes(disconnectAction)
}

function isCandidatePending(profileActionsRes) {
    const data = profileActionsRes.data
    const pendingAction =
        'com.linkedin.voyager.identity.profile.actions.InvitationPending'
    return data.includes(pendingAction)
}

function getLinkedinProfileUrlFromPublicIdentifier(publicIdentifier) {
    return `https://www.linkedin.com/${publicIdentifier}`
}

function getLinkedinProfileIdFromEntityUrn(entityUrn) {
    return entityUrn.split('urn:li:fs_miniProfile:')[1]
}

function getVoyagerHeaders(cookies) {
    const headers = {}
    headers['accept'] = '*/*'
    headers['content-type'] = 'application/json; charset=UTF-8'
    headers['x-restli-protocol-version'] = '2.0.0'

    let cookieHeader = ''
    let csrfToken = ''
    for (const cookie of cookies) {
        cookieHeader += `${cookie.name}="${cookie.value.replace(/"+/g, '')}" ;`

        if (cookie.name === 'JSESSIONID') {
            csrfToken = cookie.value.replace(/"+/g, '')
        }
    }

    // add cookie header
    headers['set-cookie'] = cookieHeader

    // add csrf-token
    headers['csrf-token'] = csrfToken

    return headers
}

async function getMe(cookies) {
    const url = `https://www.linkedin.com/voyager/api/me`
    const headers = getVoyagerHeaders(cookies)
    const res = await makeRequest('GET', url, headers, null, false)
    return res
}

async function getSessionProfileData(cookies) {
    const profileData = {}
    const getMeResponse = await getMe(cookies)
    const data = JSON.parse(getMeResponse.data)
    const miniProfile = data.miniProfile

    profileData.sessionProfileUrl = getLinkedinProfileUrlFromPublicIdentifier(
        miniProfile.publicIdentifier
    )
    profileData.sessionLinkedinProfileId = getLinkedinProfileIdFromEntityUrn(
        miniProfile.entityUrn
    )
    profileData.profileId = getProfileId(miniProfile.entityUrn)

    return profileData
}

async function getProfileView(publicIdentifier, cookies) {
    const url = `https://www.linkedin.com/voyager/api/identity/profiles/${publicIdentifier}/profileView`
    const headers = getVoyagerHeaders(cookies)
    const res = await makeRequest('GET', url, headers, null, true)
    return res
}

async function sendMessageV2(profileId, message, cookies) {
    const sendingMessageActionUrl = `https://www.linkedin.com/voyager/api/messaging/conversations?action=create`
    const headers = getVoyagerHeaders(cookies)

    const sendingMessageActionBody = {
        keyVersion: 'LEGACY_INBOX',
        conversationCreate: {
            recipients: [profileId],
            subtype: 'MEMBER_TO_MEMBER',
            eventCreate: {
                value: {
                    'com.linkedin.voyager.messaging.create.MessageCreate': {
                        body: message,
                    },
                },
            },
            dedupeByClientGeneratedToken: false,
        },
    }
    const res = await makeRequest(
        'POST',
        sendingMessageActionUrl,
        headers,
        sendingMessageActionBody,
        true
    )
    return res
}

async function sendInvitationToConnect(
    profileId,
    invitationMsg,
    trackingId,
    cookies
) {
    const url = `https://www.linkedin.com/voyager/api/growth/normInvitations`
    const headers = getVoyagerHeaders(cookies)
    const body = {
        emberEntityName: 'growth/invitation/norm-invitation',
        invitee: {
            'com.linkedin.voyager.growth.invitation.InviteeProfile': {
                profileId: profileId,
            },
        },
        message: invitationMsg,
        trackingId: trackingId,
    }
    const res = await makeRequest('POST', url, headers, body, true)
    return res
}

// sendBatchInvitationToConnect reimplements sending invitation using action  bacth Ceate
// for sending a invitation.
async function sendBatchInvitationToConnect(
    profileId,
    invitationMsg,
    trackingId,
    cookies
) {
    const url = `https://www.linkedin.com/voyager/api/growth/normInvitations?action=batchCreate`
    const headers = getVoyagerHeaders(cookies)

    const body = {
        invitations: [
            {
                emberEntityName: 'growth/invitation/norm-invitation',
                invitee: {
                    'com.linkedin.voyager.growth.invitation.InviteeProfile': {
                        profileId: profileId,
                    },
                },
                message: invitationMsg,
                trackingId: trackingId,
            },
        ],
    }

    const res = await makeRequest('POST', url, headers, body, true)
    return res
}

async function startReachout(
    linkedinUrl,
    invitationMsg,
    cookies,
    isBatchCreate
) {
    const resp = {
        code: 0,
        status: '',
    }
    try {
        await reachout(linkedinUrl, invitationMsg, cookies, isBatchCreate)
        resp.code = 200
        resp.status = 'Success'
    } catch (e) {
        console.error(`Error reachout ${JSON.stringify(e)}`)
        resp.code = e.status
        resp.status = e.message
    }
    return resp
}

async function reachout(linkedinUrl, invitationMsg, cookies, isBatchCreate) {
    const publicIdentifier = convertLinkedinUrlToPublicIdentifier(linkedinUrl)
    const conversationObj = {}
    const sessionProfileData = await getSessionProfileData(cookies)

    conversationObj['linkedin_profile_url'] = linkedinUrl
    conversationObj['session_profile_url'] =
        sessionProfileData.sessionProfileUrl
    conversationObj['session_linkedin_profile_id'] =
        sessionProfileData.sessionLinkedinProfileId

    const profileViewObj = await getProfileView(publicIdentifier, cookies)
    const profileActionObj = await getProfileActions(publicIdentifier, cookies)
    const trackingId = getTrackingId(profileViewObj)
    const targetProfileId = getProfileIdProfileView(profileViewObj)
    conversationObj['linkedin_profile_id'] = targetProfileId

    if (isCandidateConnected(profileActionObj)) {
        // 1st degree
        await sendMessageV2(targetProfileId, invitationMsg, cookies)
        console.log('Success send message')
    } else if (isCandidatePending(profileActionObj)) {
        console.log(`Candidate ${linkedinUrl} already has pending invitation`)
    } else {
        if (isBatchCreate) {
            await sendBatchInvitationToConnect(
                targetProfileId,
                invitationMsg,
                trackingId,
                cookies
            )
            console.log(`Success send invitation batchCreate to ${linkedinUrl}`)
        } else {
            await sendInvitationToConnect(
                targetProfileId,
                invitationMsg,
                trackingId,
                cookies
            )
            console.log(`Success send invitation to ${linkedinUrl}`)
        }
    }
}

// newResponse creates a new response object which is used as this project's standard.
const newResponse = function (status, statusMsg, data = null) {
    return {
        status: status,
        statusMsg: statusMsg,
        data: data,
        timestamp: new Date(),
    }
}

// makeRequest does an XHR request with async/await nature (https://stackoverflow.com/a/48969580/11835549).
async function makeRequest(
    method,
    url,
    headers,
    body = null,
    withDelay = false
) {
    const res = await (function () {
        return new Promise(function (resolve, reject) {
            // eslint-disable-next-line no-undef
            const xhr = new XMLHttpRequest()
            xhr.withCredentials = true
            xhr.open(method, url)
            xhr.onload = function () {
                if (this.status >= 200 && this.status < 300) {
                    resolve(newResponse(this.status, 'OK', xhr.response))
                } else {
                    reject(newResponse(this.status, xhr.responseText))
                }
            }
            xhr.onerror = function (error) {
                let errorStatus = 500
                if (this.status) {
                    errorStatus = this.status
                }
                reject(
                    newResponse(
                        errorStatus,
                        `XHR failed loading: ${method} ${url}`
                    )
                )
            }
            // loop through JavaScript object (https://stackoverflow.com/a/684692/11835549)
            for (const k in headers) {
                // eslint-disable-next-line no-prototype-builtins
                if (headers.hasOwnProperty(k)) {
                    xhr.setRequestHeader(k, headers[k])
                }
            }
            xhr.send(JSON.stringify(body))
        })
    })()

    return res
}
