import taskcluster from 'taskcluster-client';
import { format } from 'url';
import * as buildinfo from './moz_build_info';

const TC_CLIENT_OPTS = { timeout: 30 * 1000 };

/**
 * Options:
 *
 *   (String) product
 *   (String) os
 *   (String) branch
 *   (String) revision
 *   (String) fileSuffix
 */
export default async function detectURL(options) {
  // Figure out the appropriate index namespace.
  let nsparts = ['gecko', 'v1', options.branch];
  if (options.revision) {
    nsparts.push('revision');
    nsparts.push(options.revision);
  } else {
    nsparts.push('latest');
  }

  nsparts.push(options.product);
  nsparts.push(options.debug ? 'debug' : 'opt');
  let ns = nsparts.join('.');

  // Find task in namespace.
  let index = new taskcluster.Index(TC_CLIENT_OPTS);
  let task = await index.findTask(ns);

  // List task artifacts.
  let queue = new taskcluster.Queue(TC_CLIENT_OPTS);
  let { artifacts } = await queue.listLatestArtifacts(task.taskId);

  // Default to downloading the build archive for our os.
  let os = options.os;
  let suffix = !!options.fileSuffix ?
    options.fileSuffix :
    buildinfo.archiveFileSuffix(os);

  // Filter through namespace artifacts.
  let artifact = artifacts.find(art => art.name.indexOf(suffix) !== -1);
  if (!artifact) {
    return Promise.reject(new Error('Could not find appropriate artifact'));
  }

  // Url for build is
  // https://queue.taskcluster.net/v1/task/{taskId}/artifacts/{artifact}
  return format({
    protocol: 'https',
    host: 'queue.taskcluster.net',
    pathname: '/v1/task/' + task.taskId + '/artifacts/' + artifact.name
  });
}